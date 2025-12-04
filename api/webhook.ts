import { telegramHook, conversationWorkflow } from "../src/workflows/conversation.js";
import { logger } from "../src/lib/logger.js";
import type { TelegramEvent, ForwardedMessageData } from "../src/types/index.js";

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

function parseUpdate(update: TelegramUpdate): TelegramEvent | null {
  // Handle callback queries
  if (update.callback_query) {
    const cq = update.callback_query;
    if (!cq.message) return null;

    return {
      type: "callback_query",
      userId: cq.from.id,
      chatId: cq.message.chat.id,
      messageId: cq.message.message_id,
      callbackData: cq.data,
    };
  }

  // Handle messages
  if (update.message) {
    const msg = update.message;
    const userId = msg.from?.id;
    if (!userId) return null;

    const chatId = msg.chat.id;
    const text = msg.text || "";

    // Commands
    if (text.startsWith("/")) {
      return {
        type: "command",
        userId,
        chatId,
        messageId: msg.message_id,
        command: text.split(" ")[0].toLowerCase(),
      };
    }

    // Forwarded messages
    if (msg.forward_origin) {
      const forwardedData = extractForwardedMessageDataFromRaw(msg);
      if (forwardedData) {
        return {
          type: "forwarded_message",
          userId,
          chatId,
          messageId: msg.message_id,
          forwardedMessage: forwardedData,
        };
      }
    }

    // Regular text messages
    if (text) {
      return {
        type: "text_message",
        userId,
        chatId,
        messageId: msg.message_id,
        text,
      };
    }
  }

  return null;
}

function extractForwardedMessageDataFromRaw(message: TelegramMessage): ForwardedMessageData | null {
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

// Track active workflows (in production, Workflow SDK handles this)
const activeWorkflows = new Set<string>();

async function ensureWorkflowStarted(userId: number, chatId: number): Promise<void> {
  const workflowId = `user:${userId}`;
  
  if (!activeWorkflows.has(workflowId)) {
    activeWorkflows.add(workflowId);
    // Start workflow in background - it will wait for events via hook
    conversationWorkflow(String(userId), chatId).catch((error) => {
      logger.error("Workflow error", { userId, error });
      activeWorkflows.delete(workflowId);
    });
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await req.json() as TelegramUpdate;
    logger.debug("Received update", { updateId: update.update_id });

    const event = parseUpdate(update);
    if (!event) {
      logger.debug("Ignoring update - could not parse");
      return new Response("OK");
    }

    // Ensure workflow exists for this user
    await ensureWorkflowStarted(event.userId, event.chatId);

    // Resume workflow with the new event
    await telegramHook.resume(String(event.userId), event);

    return new Response("OK");
  } catch (error) {
    logger.error("Webhook error", { error: error instanceof Error ? error.message : String(error) });
    return new Response("OK"); // Always return OK to Telegram
  }
}
