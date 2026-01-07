import type { Api, Context } from "grammy";
import type { ReactionTypeEmoji } from "grammy/types";

/** Telegram-supported reaction emojis */
type TelegramEmoji = ReactionTypeEmoji["emoji"];

/** Default reaction sequence for processing indicators */
export const PROCESSING_REACTIONS: readonly TelegramEmoji[] = ["🤔", "⚡", "👀"];

/** Cycle interval in milliseconds */
export const REACTION_CYCLE_INTERVAL_MS = 2000;

export interface ReactionCyclerOptions {
  /** Custom reaction sequence (defaults to PROCESSING_REACTIONS) */
  reactions?: readonly TelegramEmoji[];
  /** Cycle interval in ms (defaults to 2000) */
  intervalMs?: number;
}

export interface ReactionCyclerResult {
  /** Call to stop cycling and remove reaction */
  stop: () => Promise<void>;
}

/**
 * Start cycling reactions on a message.
 * Returns a stop function that removes the reaction.
 *
 * @example
 * const { stop } = await startReactionCycling(ctx);
 * try {
 *   await doAsyncWork();
 * } finally {
 *   await stop();
 * }
 */
export async function startReactionCycling(
  ctx: Context,
  options?: ReactionCyclerOptions
): Promise<ReactionCyclerResult> {
  const reactions = options?.reactions ?? PROCESSING_REACTIONS;
  const intervalMs = options?.intervalMs ?? REACTION_CYCLE_INTERVAL_MS;

  const chatId = ctx.chat?.id;
  const messageId = ctx.message?.message_id;

  if (!chatId || !messageId) {
    // No message to react to - return no-op
    return { stop: async () => {} };
  }

  let currentIndex = 0;
  let stopped = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  // Set initial reaction
  try {
    await ctx.react(reactions[currentIndex]);
  } catch {
    // Reaction failed (permissions, etc.) - continue without cycling
    return { stop: async () => {} };
  }

  // Start cycling
  intervalHandle = setInterval(() => {
    if (stopped) return;

    currentIndex = (currentIndex + 1) % reactions.length;
    const reaction: ReactionTypeEmoji = { type: "emoji", emoji: reactions[currentIndex] };
    ctx.api.setMessageReaction(chatId, messageId, [reaction]).catch(() => {
      // Ignore cycling errors - message may have been deleted
    });
  }, intervalMs);

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;

    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }

    // Remove reaction
    try {
      await ctx.api.setMessageReaction(chatId, messageId, []);
    } catch {
      // Ignore removal errors
    }
  };

  return { stop };
}

/**
 * Higher-order wrapper for async operations with reaction cycling.
 * Automatically starts cycling before work and stops after.
 * Guarantees cleanup even on errors.
 *
 * @example
 * const result = await withReactionCycling(ctx, async () => {
 *   return await analyzeIntent(...);
 * });
 */
export async function withReactionCycling<T>(
  ctx: Context,
  work: () => Promise<T>,
  options?: ReactionCyclerOptions
): Promise<T> {
  const { stop } = await startReactionCycling(ctx, options);
  try {
    return await work();
  } finally {
    await stop();
  }
}

/**
 * Set a reaction on a specific message (for use without ctx.message).
 * Useful for callback handlers where ctx.message is not the user's original message.
 */
export async function setReaction(
  api: Api,
  chatId: number,
  messageId: number,
  emoji: TelegramEmoji | null
): Promise<void> {
  try {
    const reactions: ReactionTypeEmoji[] = emoji ? [{ type: "emoji", emoji }] : [];
    await api.setMessageReaction(chatId, messageId, reactions);
  } catch {
    // Ignore errors (message deleted, no permissions, etc.)
  }
}

/**
 * Remove reaction from a specific message.
 */
export async function removeReaction(api: Api, chatId: number, messageId: number): Promise<void> {
  await setReaction(api, chatId, messageId, null);
}
