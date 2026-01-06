import type { Context } from "grammy";
import { getOrCreateSession, updateSession } from "@/src/lib/kv/session.kv";
import { getPending, clearPending } from "@/src/lib/kv/pending.kv";
import type { ForwardedMessageData } from "@/src/types";

/**
 * Extract forwarded message data from context.
 */
function extractForwardedMessage(ctx: Context): ForwardedMessageData | null {
  const msg = ctx.message;
  if (!msg) return null;

  // Check if message is forwarded
  const forwardOrigin = msg.forward_origin;
  if (!forwardOrigin) return null;

  let senderUsername: string | undefined;
  let senderFirstName: string | undefined;
  let senderLastName: string | undefined;
  let chatName = "Unknown";

  if (forwardOrigin.type === "user") {
    const sender = forwardOrigin.sender_user;
    senderUsername = sender.username;
    senderFirstName = sender.first_name;
    senderLastName = sender.last_name;
    chatName = [sender.first_name, sender.last_name].filter(Boolean).join(" ") || "Unknown User";
  } else if (forwardOrigin.type === "chat") {
    chatName = forwardOrigin.sender_chat.title || "Unknown Chat";
  } else if (forwardOrigin.type === "channel") {
    chatName = forwardOrigin.chat.title || "Unknown Channel";
  } else if (forwardOrigin.type === "hidden_user") {
    chatName = forwardOrigin.sender_user_name || "Hidden User";
  }

  // Get message content
  const text = msg.text || msg.caption || "";
  const hasMedia = !!(msg.photo || msg.video || msg.document || msg.audio || msg.voice);
  let mediaType: string | undefined;
  if (msg.photo) mediaType = "photo";
  else if (msg.video) mediaType = "video";
  else if (msg.document) mediaType = "document";
  else if (msg.audio) mediaType = "audio";
  else if (msg.voice) mediaType = "voice note";

  return {
    text,
    senderUsername,
    senderFirstName,
    senderLastName,
    chatName,
    date: forwardOrigin.date,
    messageId: msg.message_id,
    hasMedia,
    mediaType,
  };
}

/**
 * Handle forwarded messages.
 * Adds to queue and optionally processes with pending instruction.
 */
export async function handleForward(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Extract forwarded message data
  const forwardedMessage = extractForwardedMessage(ctx);
  if (!forwardedMessage) {
    return; // Not a forwarded message
  }

  // Get session
  const session = await getOrCreateSession(chatId);

  // Add to queue
  const updatedQueue = [...session.messageQueue, forwardedMessage];

  // Check for pending instruction (forward + instruction correlation)
  const pending = await getPending(chatId);
  if (pending) {
    // Clear pending and process with instruction
    await clearPending(chatId);

    // Update session and trigger processing
    await updateSession(chatId, {
      messageQueue: updatedQueue,
      state: { type: "gathering_messages" },
    });

    // React to show we received it
    try {
      await ctx.react("👀");
    } catch {
      // Ignore reaction errors
    }

    // Reply with processing hint
    await ctx.reply(
      `📦 Added message (${updatedQueue.length} in queue)\n\n` +
        `Instruction: "${pending.text}"\n` +
        `Use /done to process, or forward more messages.`
    );
  } else {
    // Just add to queue
    await updateSession(chatId, {
      messageQueue: updatedQueue,
      state: { type: "gathering_messages" },
    });

    // React to show we received it
    try {
      await ctx.react("👀");
    } catch {
      // Ignore reaction errors
    }

    // Show queue status
    await ctx.reply(
      `📦 Added to queue (${updatedQueue.length} message${updatedQueue.length === 1 ? "" : "s"})\n\n` +
        `When ready:\n` +
        `/done <instruction>`
    );
  }
}
