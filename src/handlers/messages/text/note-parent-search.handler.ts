/**
 * Handler for awaiting_note_parent_search state.
 * Searches for records to attach a note to.
 */

import type { Context } from "grammy";
import { updateSession } from "@/src/lib/kv/session.kv";
import { searchRecords } from "@/src/workflows/attio-actions";
import { buildNoteParentSearchResultsKeyboard } from "@/src/lib/telegram/keyboards";
import type { ConversationState } from "@/src/lib/types/session.types";

type NoteParentSearchState = Extract<ConversationState, { type: "awaiting_note_parent_search" }>;

export async function handleNoteParentSearchState(
  ctx: Context,
  chatId: number,
  userId: number,
  text: string,
  state: NoteParentSearchState
): Promise<void> {
  const { parentType } = state;

  const results = await searchRecords(parentType, text);

  if (results.length === 0) {
    await ctx.reply(`❌ No ${parentType} found matching "${text}".\n\nTry again or /cancel.`);
  } else {
    const keyboard = buildNoteParentSearchResultsKeyboard(results);
    await ctx.reply(`Found ${results.length} result(s):`, { reply_markup: keyboard });

    await updateSession(chatId, userId, {
      state: {
        type: "awaiting_note_parent_selection",
        results,
      },
    });
  }
}
