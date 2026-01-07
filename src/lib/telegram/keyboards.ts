/**
 * Re-exports from modular keyboards for backwards compatibility.
 * @deprecated Import from "@/src/lib/telegram/keyboards" instead.
 *
 * Keyboard builders have been split into focused modules:
 * - confirmation.keyboard.ts - Confirmation/clarification/edit keyboards
 * - assignee.keyboard.ts - Assignee selection with pagination
 * - note-parent.keyboard.ts - Note parent type/selection keyboards
 * - search.keyboard.ts - Generic search results keyboard
 * - formatter.ts - Action formatting for display
 */

export {
  buildConfirmationKeyboard,
  buildClarificationKeyboard,
  buildEditFieldKeyboard,
  buildAssigneeKeyboard,
  buildNoteParentTypeKeyboard,
  buildNoteParentSearchResultsKeyboard,
  buildSearchResultsKeyboard,
  formatSuggestedAction,
} from "./keyboards/index";
