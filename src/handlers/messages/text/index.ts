/**
 * Text message handler router.
 * Routes to appropriate handler based on session state.
 */

import type { Context } from "grammy";
import { getSession } from "@/src/lib/kv/session.kv";
import { handleIdleState } from "./idle.handler";
import { handleClarificationState } from "./clarification.handler";
import { handleEditState } from "./edit.handler";
import { handleAssigneeInputState } from "./assignee-input.handler";
import { handleNoteParentSearchState } from "./note-parent-search.handler";

/**
 * Handle text messages.
 * Routes based on current session state.
 */
export async function handleText(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const text = ctx.message?.text;
  if (!chatId || !userId || !text) return;

  // Get session
  const session = await getSession(chatId, userId);

  if (!session) {
    // No session - treat as instruction before forward
    await handleIdleState(ctx, chatId, userId, text, null);
    return;
  }

  // Route based on state
  switch (session.state.type) {
    case "idle":
    case "gathering_messages":
      await handleIdleState(ctx, chatId, userId, text, session);
      break;

    case "awaiting_clarification":
      await handleClarificationState(ctx, chatId, userId, text, session, session.state);
      break;

    case "awaiting_edit":
      await handleEditState(ctx, chatId, userId, text, session, session.state);
      break;

    case "awaiting_assignee_input":
      await handleAssigneeInputState(ctx, chatId, userId, text, session);
      break;

    case "awaiting_note_parent_search":
      await handleNoteParentSearchState(ctx, chatId, userId, text, session.state);
      break;

    default:
      // Unexpected state, suggest starting over
      await ctx.reply(
        "🤔 I'm not sure what to do with that.\n\n" +
          "Use /help to see available commands, or /cancel to start over."
      );
  }
}
