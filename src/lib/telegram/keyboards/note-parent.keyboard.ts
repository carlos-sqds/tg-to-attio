/**
 * Note parent selection keyboards.
 */

import { InlineKeyboard } from "grammy";
import type { SearchResult } from "@/src/lib/types/session.types";
import { CallbackAction, buildCallbackData } from "@/src/lib/types/callback.types";

/**
 * Build keyboard for selecting note parent type.
 */
export function buildNoteParentTypeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🏢 Company", buildCallbackData(CallbackAction.NOTE_PARENT_TYPE, "companies"))
    .row()
    .text("👤 Person", buildCallbackData(CallbackAction.NOTE_PARENT_TYPE, "people"))
    .row()
    .text("💰 Deal", buildCallbackData(CallbackAction.NOTE_PARENT_TYPE, "deals"))
    .row()
    .text("❌ Cancel", CallbackAction.CANCEL);
}

/**
 * Build keyboard for selecting note parent from search results.
 */
export function buildNoteParentSearchResultsKeyboard(results: SearchResult[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const result of results.slice(0, 5)) {
    const label = result.extra ? `${result.name} (${result.extra})` : result.name;
    keyboard.text(label, buildCallbackData(CallbackAction.NOTE_PARENT_SELECT, result.id)).row();
  }

  keyboard
    .text("🔍 Search again", CallbackAction.NOTE_PARENT_SEARCH)
    .text("❌ Cancel", CallbackAction.CANCEL);

  return keyboard;
}
