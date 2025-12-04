import type { VercelRequest, VercelResponse } from "@vercel/node";
import { logger } from "../src/lib/logger.js";
import type { ForwardedMessageData } from "../src/types/index.js";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
  caption?: string;
  forward_origin?: unknown;
  date: number;
  photo?: unknown[];
  video?: unknown;
  document?: unknown;
  audio?: unknown;
  voice?: unknown;
  video_note?: unknown;
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function extractForwardedMessage(message: TelegramMessage): ForwardedMessageData | null {
  if (!message.forward_origin) return null;

  const origin = message.forward_origin as {
    type: string;
    sender_user?: { username?: string; first_name?: string; last_name?: string };
    sender_chat?: { title?: string };
    chat?: { title?: string };
    sender_user_name?: string;
  };

  let senderUsername: string | undefined;
  let senderFirstName: string | undefined;
  let senderLastName: string | undefined;
  let chatName = "Unknown";

  if (origin.type === "user" && origin.sender_user) {
    senderUsername = origin.sender_user.username;
    senderFirstName = origin.sender_user.first_name;
    senderLastName = origin.sender_user.last_name;
    chatName = [senderFirstName, senderLastName].filter(Boolean).join(" ");
  } else if (origin.type === "chat" && origin.sender_chat) {
    chatName = origin.sender_chat.title || "Unknown Chat";
  } else if (origin.type === "channel" && origin.chat) {
    chatName = origin.chat.title || "Unknown Channel";
  } else if (origin.type === "hidden_user") {
    chatName = origin.sender_user_name || "Hidden User";
  }

  const text = message.text || message.caption || "";
  const hasMedia = !!(message.photo || message.video || message.document || message.audio);

  let mediaType: string | undefined;
  if (message.photo) mediaType = "photo";
  else if (message.video) mediaType = "video";
  else if (message.document) mediaType = "document";
  else if (message.audio) mediaType = "audio";
  else if (message.voice) mediaType = "voice";
  else if (message.video_note) mediaType = "video_note";

  return {
    text,
    senderUsername,
    senderFirstName,
    senderLastName,
    chatName,
    date: message.date,
    messageId: message.message_id,
    hasMedia,
    mediaType,
  };
}

const WELCOME_MESSAGE = `👋 Welcome to the Attio CRM Bot!

📋 How it works:

1️⃣ Forward me messages from your customer conversations
2️⃣ When you're done forwarding, send /done
3️⃣ Select which company they belong to
4️⃣ All messages will be added to that company in Attio

Commands:
/done - Process queued messages
/clear - Clear message queue
/cancel - Cancel current operation
/help - Show this help message`;

// Simple in-memory store for demo - in production use Redis/KV
// Note: This won't persist across serverless invocations
// For production, use Upstash Redis or Vercel KV
const messageQueues = new Map<number, ForwardedMessageData[]>();

function getQueue(userId: number): ForwardedMessageData[] {
  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, []);
  }
  return messageQueues.get(userId)!;
}

function clearQueue(userId: number): number {
  const count = getQueue(userId).length;
  messageQueues.set(userId, []);
  return count;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const update = req.body as TelegramUpdate;

    // Handle callback queries - not implemented in simple mode
    if (update.callback_query) {
      // For now, just acknowledge callback queries
      res.status(200).send("OK");
      return;
    }

    // Handle messages
    if (update.message) {
      const msg = update.message;
      const userId = msg.from?.id;
      if (!userId) {
        res.status(200).send("OK");
        return;
      }

      const chatId = msg.chat.id;
      const text = msg.text || "";

      // Commands
      if (text.startsWith("/")) {
        const command = text.split(" ")[0].toLowerCase();

        if (command === "/start" || command === "/help") {
          await sendTelegramMessage(chatId, WELCOME_MESSAGE);
          logger.info("Sent welcome message", { userId, command });
          res.status(200).send("OK");
          return;
        }

        if (command === "/clear") {
          const count = clearQueue(userId);
          await sendTelegramMessage(chatId, count > 0 ? `🗑️ Cleared ${count} message(s) from queue.` : "✨ Queue is already empty.");
          logger.info("Cleared queue", { userId, count });
          res.status(200).send("OK");
          return;
        }

        if (command === "/done") {
          const queue = getQueue(userId);
          if (queue.length === 0) {
            await sendTelegramMessage(chatId, "📭 No messages in queue. Forward some messages first!");
          } else {
            await sendTelegramMessage(chatId, `📊 You have ${queue.length} message(s) queued.\n\n⚠️ Full workflow with company selection requires Redis storage. For now, use /clear to reset.`);
          }
          logger.info("Done command", { userId, queueLength: queue.length });
          res.status(200).send("OK");
          return;
        }

        res.status(200).send("OK");
        return;
      }

      // Forwarded messages
      if (msg.forward_origin) {
        const forwardedMessage = extractForwardedMessage(msg);
        if (forwardedMessage) {
          const queue = getQueue(userId);
          queue.push(forwardedMessage);
          await sendTelegramMessage(chatId, `📥 Message queued (${queue.length})\n\nSend more messages or use /done to process them.`);
          logger.info("Queued forwarded message", { userId, queueLength: queue.length });
        }
        res.status(200).send("OK");
        return;
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    logger.error("Webhook error", { error: error instanceof Error ? error.message : String(error) });
    res.status(200).send("OK");
  }
}
