import { NextRequest, NextResponse } from "next/server";
import { start, getHookByToken, Run } from "workflow/api";
import { logger } from "@/src/lib/logger";
import { telegramHook, type TelegramEvent } from "@/workflows/hooks";
import { conversationWorkflowAI } from "@/workflows/conversation-ai";
import type { ForwardedMessageData } from "@/src/types";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Track pending instructions for forward correlation
// Key: chatId, Value: { text, timestamp, messageId, callerInfo }
interface PendingInstruction {
  text: string;
  timestamp: number;
  messageId: number;
  callerInfo?: { firstName?: string; lastName?: string; username?: string };
}
const pendingInstructions = new Map<number, PendingInstruction>();
const INSTRUCTION_TIMEOUT_MS = 2000; // 2 seconds window

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
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

async function tryResumeWorkflow(
  userId: number,
  chatId: number,
  event: TelegramEvent
): Promise<boolean> {
  const token = `ai7-${userId}-${chatId}`;

  // Retry logic to handle race condition where workflow hasn't created hook yet
  const maxRetries = 3;
  const retryDelay = 300; // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await telegramHook.resume(token, event);
      logger.info("Resumed workflow", { userId, eventType: event.type, attempt });
      return true;
    } catch (error) {
      logger.info("Failed to resume workflow", {
        userId,
        error: String(error),
        attempt,
        maxRetries,
      });
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const update = (await request.json()) as TelegramUpdate;

    // Handle callback queries
    if (update.callback_query) {
      const cq = update.callback_query;
      if (!cq.message) {
        return NextResponse.json({ ok: true });
      }

      const userId = cq.from.id;
      const chatId = cq.message.chat.id;

      const event: TelegramEvent = {
        type: "callback_query",
        callbackData: cq.data || "",
        callbackQueryId: cq.id,
      };

      const success = await tryResumeWorkflow(userId, chatId, event);
      if (!success) {
        await sendTelegramMessage(chatId, "Please send /start first to begin.");
      }
      return NextResponse.json({ ok: true });
    }

    // Handle messages
    if (update.message) {
      const msg = update.message;
      const userId = msg.from?.id;
      if (!userId) {
        return NextResponse.json({ ok: true });
      }

      const chatId = msg.chat.id;
      const text = msg.text || "";

      // /start - Start a new workflow (workflow will send welcome)
      if (text === "/start") {
        console.log("[WEBHOOK] /start received", { userId, chatId });
        try {
          const hookToken = `ai7-${userId}-${chatId}`;
          console.log("[WEBHOOK] Attempting to terminate existing workflow", { hookToken });

          // Try graceful terminate first (works for new workflows with terminate handler)
          try {
            await telegramHook.resume(hookToken, { type: "terminate" });
            console.log("[WEBHOOK] Terminate sent successfully");
            logger.info("Sent terminate to existing workflow", { userId });
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (terminateError) {
            console.log("[WEBHOOK] Graceful terminate failed, trying force cancel", {
              error: String(terminateError),
            });
            // Fall back to Run.cancel() for old workflows that don't have terminate handler
            try {
              const existingHook = await getHookByToken(hookToken);
              if (existingHook?.runId) {
                console.log("[WEBHOOK] Found existing hook, canceling run", {
                  runId: existingHook.runId,
                });
                await new Run(existingHook.runId).cancel();
                logger.info("Force cancelled existing workflow", {
                  userId,
                  runId: existingHook.runId,
                });
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            } catch (cancelError) {
              console.log("[WEBHOOK] No existing workflow to cancel", {
                error: String(cancelError),
              });
            }
          }

          console.log("[WEBHOOK] Starting new workflow...");
          const run = await start(conversationWorkflowAI, [userId, chatId]);
          console.log("[WEBHOOK] Workflow started", { runId: run.runId });
          logger.info("Started new AI workflow", { userId, runId: run.runId });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error("[WEBHOOK] Failed to start workflow", {
            error: errorMsg,
            stack: errorStack,
          });
          logger.error("Failed to start workflow", { userId, error: errorMsg, stack: errorStack });
          await sendTelegramMessage(chatId, `Failed to start: ${errorMsg.substring(0, 100)}`);
        }
        return NextResponse.json({ ok: true });
      }

      // /help - Send help directly (no workflow needed)
      if (text === "/help") {
        await sendTelegramMessage(
          chatId,
          `Commands:
/start - Start a new session
/done - Process queued messages
/clear - Clear message queue
/cancel - Cancel current operation
/help - Show this help message`
        );
        return NextResponse.json({ ok: true });
      }

      // All other commands - try to resume workflow
      if (text.startsWith("/")) {
        const command = text.split(" ")[0].toLowerCase();

        // For /done, send as text_message to preserve the instruction
        if (command === "/done") {
          console.log("[WEBHOOK] /done command received, text:", text.substring(0, 50));
          const event: TelegramEvent = {
            type: "text_message",
            text,
            messageId: msg.message_id,
            callerInfo: {
              firstName: msg.from?.first_name,
              lastName: msg.from?.last_name,
              username: msg.from?.username,
            },
          };
          const success = await tryResumeWorkflow(userId, chatId, event);
          console.log("[WEBHOOK] tryResumeWorkflow result:", success);
          if (!success) {
            await sendTelegramMessage(chatId, "Please send /start first to begin.");
          }
          return NextResponse.json({ ok: true });
        }

        // For /new, send as new_command with the instruction
        if (command === "/new") {
          const instruction = text.replace(/^\/new\s*/i, "").trim();
          console.log(
            "[WEBHOOK] /new command received, instruction:",
            instruction.substring(0, 50)
          );

          if (!instruction) {
            await sendTelegramMessage(
              chatId,
              `Usage: /new <instruction>

Examples:
• /new create task for John to call Acme
• /new add company TechCorp
• /new person Jane Doe from TechCorp
• /new deal $50k with Acme
• /new add note to TechCorp`
            );
            return NextResponse.json({ ok: true });
          }

          const event: TelegramEvent = {
            type: "new_command",
            instruction,
            messageId: msg.message_id,
            callerInfo: {
              firstName: msg.from?.first_name,
              lastName: msg.from?.last_name,
              username: msg.from?.username,
            },
          };
          const success = await tryResumeWorkflow(userId, chatId, event);
          if (!success) {
            await sendTelegramMessage(chatId, "Please send /start first to begin.");
          }
          return NextResponse.json({ ok: true });
        }

        const event: TelegramEvent = { type: "command", command, messageId: msg.message_id };
        const success = await tryResumeWorkflow(userId, chatId, event);
        if (!success) {
          await sendTelegramMessage(chatId, "Please send /start first to begin.");
        }
        return NextResponse.json({ ok: true });
      }

      // Forwarded messages - check for pending instruction first
      if (msg.forward_origin) {
        const forwardedMessage = extractForwardedMessage(msg);
        if (forwardedMessage) {
          // Check for pending instruction from this chat
          const pending = pendingInstructions.get(chatId);
          const now = Date.now();

          if (pending && now - pending.timestamp < INSTRUCTION_TIMEOUT_MS) {
            // Found a recent instruction - combine with forward
            pendingInstructions.delete(chatId);
            const event: TelegramEvent = {
              type: "forward_with_instruction",
              forwardedMessage,
              instruction: pending.text,
              messageId: pending.messageId,
              callerInfo: pending.callerInfo,
            };

            const success = await tryResumeWorkflow(userId, chatId, event);
            if (!success) {
              await sendTelegramMessage(chatId, "Please send /start first to begin.");
            }
          } else {
            // No pending instruction - regular forward
            const event: TelegramEvent = { type: "forwarded_message", forwardedMessage };

            const success = await tryResumeWorkflow(userId, chatId, event);
            if (!success) {
              await sendTelegramMessage(chatId, "Please send /start first to begin.");
            }
          }
        }
        return NextResponse.json({ ok: true });
      }

      // Regular text messages - store as potential instruction for forward correlation
      if (text && !text.startsWith("/")) {
        // Store as pending instruction (might be followed by a forward)
        pendingInstructions.set(chatId, {
          text,
          timestamp: Date.now(),
          messageId: msg.message_id,
          callerInfo: {
            firstName: msg.from?.first_name,
            lastName: msg.from?.last_name,
            username: msg.from?.username,
          },
        });

        // Also try to resume workflow (for company search, clarifications, etc.)
        const event: TelegramEvent = { type: "text_message", text };
        const success = await tryResumeWorkflow(userId, chatId, event);
        if (!success) {
          await sendTelegramMessage(chatId, "Please send /start first to begin.");
        }
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Webhook error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: true });
  }
}
