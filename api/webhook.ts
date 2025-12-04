import type { VercelRequest, VercelResponse } from "@vercel/node";
import { start, getRun } from "workflow/api";
import { logger } from "../src/lib/logger.js";
import { telegramHook, type TelegramEvent } from "../src/workflows/hooks.js";
import { conversationWorkflow } from "../src/workflows/conversation.js";
import type { ForwardedMessageData } from "../src/types/index.js";

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

const activeWorkflows = new Map<number, string>();

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

async function ensureWorkflowRunning(userId: number, chatId: number): Promise<void> {
  const token = `user-${userId}`;

  if (!activeWorkflows.has(userId)) {
    const run = await start(conversationWorkflow, [userId, chatId]);
    activeWorkflows.set(userId, run.runId);
    logger.info("Started new workflow", { userId, runId: run.runId });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const update = req.body as TelegramUpdate;

    // Handle callback queries
    if (update.callback_query) {
      const cq = update.callback_query;
      if (!cq.message) {
        res.status(200).send("OK");
        return;
      }

      const userId = cq.from.id;
      const chatId = cq.message.chat.id;
      const token = `user-${userId}`;

      await ensureWorkflowRunning(userId, chatId);

      const event: TelegramEvent = {
        type: "callback_query",
        callbackData: cq.data || "",
        callbackQueryId: cq.id,
      };

      await telegramHook.resume(token, event);
      logger.info("Resumed workflow with callback", { userId, data: cq.data });

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

      await ensureWorkflowRunning(userId, chatId);

      // Commands
      if (text.startsWith("/")) {
        const command = text.split(" ")[0].toLowerCase();

        const event: TelegramEvent = {
          type: "command",
          command,
        };

        await telegramHook.resume(token, event);
        logger.info("Resumed workflow with command", { userId, command });

        res.status(200).send("OK");
        return;
      }

      // Forwarded messages
      if (msg.forward_origin) {
        const forwardedMessage = extractForwardedMessage(msg);
        if (forwardedMessage) {
          const event: TelegramEvent = {
            type: "forwarded_message",
            forwardedMessage,
          };

          await telegramHook.resume(token, event);
          logger.info("Resumed workflow with forwarded message", { userId });
        }

        res.status(200).send("OK");
        return;
      }

      // Regular text messages
      if (text && !text.startsWith("/")) {
        const event: TelegramEvent = {
          type: "text_message",
          text,
        };

        await telegramHook.resume(token, event);
        logger.info("Resumed workflow with text message", { userId });

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
