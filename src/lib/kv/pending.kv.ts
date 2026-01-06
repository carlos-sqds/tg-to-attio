import { kv } from "@vercel/kv";
import type { PendingInstruction, CallerInfo } from "@/src/lib/types/session.types";

/**
 * KV key for pending instruction.
 * Prefixed with "attio:" to avoid collision.
 * Keys are scoped by both chatId and userId to isolate each user's pending instructions in group chats.
 */
const PENDING_KEY = (chatId: number, userId: number) => `attio:pending:${chatId}:${userId}`;

/**
 * Pending instruction TTL in seconds.
 * Short window (2 seconds) to correlate forward + instruction.
 */
const PENDING_TTL_SECONDS = 2;

/**
 * Get pending instruction from KV.
 * Returns null if no pending instruction or expired.
 */
export async function getPending(
  chatId: number,
  userId: number
): Promise<PendingInstruction | null> {
  return kv.get<PendingInstruction>(PENDING_KEY(chatId, userId));
}

/**
 * Set pending instruction in KV with short TTL.
 * Used when user sends instruction before forwarding message.
 */
export async function setPending(
  chatId: number,
  userId: number,
  text: string,
  messageId: number,
  callerInfo: CallerInfo
): Promise<void> {
  const pending: PendingInstruction = {
    text,
    messageId,
    callerInfo,
    createdAt: new Date().toISOString(),
  };
  await kv.set(PENDING_KEY(chatId, userId), pending, { ex: PENDING_TTL_SECONDS });
}

/**
 * Clear pending instruction from KV.
 * Call after correlating with forwarded message.
 */
export async function clearPending(chatId: number, userId: number): Promise<void> {
  await kv.del(PENDING_KEY(chatId, userId));
}

/**
 * Check if there's a pending instruction for this chat and user.
 */
export async function hasPending(chatId: number, userId: number): Promise<boolean> {
  const pending = await getPending(chatId, userId);
  return pending !== null;
}
