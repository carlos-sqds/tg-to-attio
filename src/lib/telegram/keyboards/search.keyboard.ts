/**
 * Search results selection keyboard.
 */

import { InlineKeyboard } from "grammy";
import type { SearchResult } from "@/src/lib/types/session.types";
import { CallbackAction, buildCallbackData } from "@/src/lib/types/callback.types";

/**
 * Build keyboard for search result selection.
 * Generic version for any record type.
 */
export function buildSearchResultsKeyboard(
  results: SearchResult[],
  showCreateNew: boolean = true
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const result of results.slice(0, 5)) {
    const label = result.extra ? `${result.name} (${result.extra})` : result.name;
    keyboard.text(label, buildCallbackData(CallbackAction.NOTE_PARENT_SELECT, result.id)).row();
  }

  if (showCreateNew) {
    keyboard.text("➕ Create new", buildCallbackData(CallbackAction.CLARIFY_OPTION, "__create__"));
  }
  keyboard.text("❌ Cancel", CallbackAction.CANCEL);

  return keyboard;
}
