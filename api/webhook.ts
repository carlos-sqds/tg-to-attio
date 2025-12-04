import type { VercelRequest, VercelResponse } from "@vercel/node";
import { start } from "workflow/api";
import { logger } from "../src/lib/logger.js";
import { telegramHook, type TelegramEvent } from "../src/workflows/hooks.js";
import { conversationWorkflow } from "../src/workflows/conversation.js";
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

async function startWorkflowAndResume(userId: number, chatId: number, event: TelegramEvent): Promise<void> {
  const token = `user-${userId}`;
  
  // Start workflow - it will create the hook and wait for events
  const run = await start(conversationWorkflow, [userId, chatId]);
  logger.info("Started workflow", { userId, runId: run.runId });
  
  // Give the workflow time to initialize and create the hook
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Now resume with the event
  await telegramHook.resume(token, event);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const update = req.body as TelegramUpdate;

    // Handle callback queries - these always go to the workflow
    if (update.callback_query) {
      const cq = update.callback_query;
      if (!cq.message) {
        res.status(200).send("OK");
        return;
      }

      const userId = cq.from.id;
      const chatId = cq.message.chat.id;
      const token = `user-${userId}`;

      const event: TelegramEvent = {
        type: "callback_query",
        callbackData: cq.data || "",
        callbackQueryId: cq.id,
      };

      try {
        await telegramHook.resume(token, event);
        logger.info("Resumed workflow with callback", { userId, data: cq.data });
      } catch (error) {
        logger.error("Failed to resume workflow", { userId, error });
      }

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
      const token = `user-${userId}`;

      // Commands
      if (text.startsWith("/")) {
        const command = text.split(" ")[0].toLowerCase();

        // Handle /start and /help directly (no workflow needed)
        if (command === "/start" || command === "/help") {
          await sendTelegramMessage(chatId, WELCOME_MESSAGE);
          logger.info("Sent welcome message", { userId, command });
          res.status(200).send("OK");
          return;
        }

        // Other commands start a workflow
        const event: TelegramEvent = {
          type: "command",
          command,
        };

        await startWorkflowAndResume(userId, chatId, event);
        logger.info("Started workflow with command", { userId, command });

        res.status(200).send("OK");
        return;
      }

      // Forwarded messages - start workflow if needed
      if (msg.forward_origin) {
        const forwardedMessage = extractForwardedMessage(msg);
        if (forwardedMessage) {
          const event: TelegramEvent = {
            type: "forwarded_message",
            forwardedMessage,
          };

          await startWorkflowAndResume(userId, chatId, event);
          logger.info("Started workflow with forwarded message", { userId });
        }

        res.status(200).send("OK");
        return;
      }

      // Regular text messages - try to resume existing workflow
      if (text && !text.startsWith("/")) {
        const event: TelegramEvent = {
          type: "text_message",
          text,
        };

        try {
          await telegramHook.resume(token, event);
          logger.info("Resumed workflow with text message", { userId });
        } catch (error) {
          // No workflow running, start one
          await startWorkflowAndResume(userId, chatId, event);
          logger.info("Started workflow with text message", { userId });
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
