import { kv } from "@vercel/kv";
import type { SessionState } from "@/src/lib/types/session.types";
import { createEmptySession } from "@/src/lib/types/session.types";

/**
 * KV key for session state.
 * Prefixed with "attio:" to avoid collision with other apps sharing the same KV.
 * Keys are scoped by both chatId and userId to isolate each user's session in group chats.
 */
const SESSION_KEY = (chatId: number, userId: number) => `attio:session:${chatId}:${userId}`;

/**
 * Get session state from KV.
 * Returns null if no session exists.
 */
export async function getSession(chatId: number, userId: number): Promise<SessionState | null> {
  return kv.get<SessionState>(SESSION_KEY(chatId, userId));
}

/**
 * Get session state, creating a new one if it doesn't exist.
 */
export async function getOrCreateSession(chatId: number, userId: number): Promise<SessionState> {
  const existing = await getSession(chatId, userId);
  if (existing) {
    return existing;
  }

  const newSession = createEmptySession();
  await setSession(chatId, userId, newSession);
  return newSession;
}

/**
 * Set session state in KV.
 * Updates the updatedAt timestamp automatically.
 */
export async function setSession(
  chatId: number,
  userId: number,
  session: SessionState
): Promise<void> {
  const updated: SessionState = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(SESSION_KEY(chatId, userId), updated);
}

/**
 * Update session state with a partial update.
 * Merges with existing state and updates timestamp.
 */
export async function updateSession(
  chatId: number,
  userId: number,
  update: Partial<SessionState>
): Promise<SessionState> {
  const existing = await getOrCreateSession(chatId, userId);
  const updated: SessionState = {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(SESSION_KEY(chatId, userId), updated);
  return updated;
}

/**
 * Clear session state from KV.
 */
export async function clearSession(chatId: number, userId: number): Promise<void> {
  await kv.del(SESSION_KEY(chatId, userId));
}

/**
 * Reset session to idle state while preserving metadata.
 * Use after completing or canceling an action.
 */
export async function resetSession(chatId: number, userId: number): Promise<SessionState> {
  const existing = await getSession(chatId, userId);
  const reset: SessionState = {
    ...createEmptySession(),
    schema: existing?.schema ?? null, // Preserve cached schema
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(SESSION_KEY(chatId, userId), reset);
  return reset;
}
