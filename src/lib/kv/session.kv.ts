import { kv } from "@vercel/kv";
import type { SessionState } from "@/src/lib/types/session.types";
import { createEmptySession } from "@/src/lib/types/session.types";

/**
 * KV key for session state.
 * Prefixed with "attio:" to avoid collision with other apps sharing the same KV.
 */
const SESSION_KEY = (chatId: number) => `attio:session:${chatId}`;

/**
 * Get session state from KV.
 * Returns null if no session exists.
 */
export async function getSession(chatId: number): Promise<SessionState | null> {
  return kv.get<SessionState>(SESSION_KEY(chatId));
}

/**
 * Get session state, creating a new one if it doesn't exist.
 */
export async function getOrCreateSession(chatId: number): Promise<SessionState> {
  const existing = await getSession(chatId);
  if (existing) {
    return existing;
  }

  const newSession = createEmptySession();
  await setSession(chatId, newSession);
  return newSession;
}

/**
 * Set session state in KV.
 * Updates the updatedAt timestamp automatically.
 */
export async function setSession(chatId: number, session: SessionState): Promise<void> {
  const updated: SessionState = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(SESSION_KEY(chatId), updated);
}

/**
 * Update session state with a partial update.
 * Merges with existing state and updates timestamp.
 */
export async function updateSession(
  chatId: number,
  update: Partial<SessionState>
): Promise<SessionState> {
  const existing = await getOrCreateSession(chatId);
  const updated: SessionState = {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(SESSION_KEY(chatId), updated);
  return updated;
}

/**
 * Clear session state from KV.
 */
export async function clearSession(chatId: number): Promise<void> {
  await kv.del(SESSION_KEY(chatId));
}

/**
 * Reset session to idle state while preserving metadata.
 * Use after completing or canceling an action.
 */
export async function resetSession(chatId: number): Promise<SessionState> {
  const existing = await getSession(chatId);
  const reset: SessionState = {
    ...createEmptySession(),
    schema: existing?.schema ?? null, // Preserve cached schema
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(SESSION_KEY(chatId), reset);
  return reset;
}
