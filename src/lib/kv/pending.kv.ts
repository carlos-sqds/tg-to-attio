import { kv } from "@vercel/kv";
import type { PendingInstruction, CallerInfo } from "@/src/lib/types/session.types";

/**
 * KV key for pending instruction.
 * Prefixed with "attio:" to avoid collision.
 */
const PENDING_KEY = (chatId: number) => `attio:pending:${chatId}`;

/**
 * Pending instruction TTL in seconds.
 * Short window (2 seconds) to correlate forward + instruction.
 */
const PENDING_TTL_SECONDS = 2;

/**
 * Get pending instruction from KV.
 * Returns null if no pending instruction or expired.
 */
export async function getPending(chatId: number): Promise<PendingInstruction | null> {
  return kv.get<PendingInstruction>(PENDING_KEY(chatId));
}

/**
 * Set pending instruction in KV with short TTL.
 * Used when user sends instruction before forwarding message.
 */
export async function setPending(
  chatId: number,
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
  await kv.set(PENDING_KEY(chatId), pending, { ex: PENDING_TTL_SECONDS });
}

/**
 * Clear pending instruction from KV.
 * Call after correlating with forwarded message.
 */
export async function clearPending(chatId: number): Promise<void> {
  await kv.del(PENDING_KEY(chatId));
}

/**
 * Check if there's a pending instruction for this chat.
 */
export async function hasPending(chatId: number): Promise<boolean> {
  const pending = await getPending(chatId);
  return pending !== null;
}
