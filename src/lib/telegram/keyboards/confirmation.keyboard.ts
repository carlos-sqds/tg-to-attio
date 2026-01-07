/**
 * Confirmation and clarification keyboards for AI suggestions.
 */

import { InlineKeyboard } from "grammy";
import { CallbackAction, buildCallbackData } from "@/src/lib/types/callback.types";
import { AttioIntent, COMPANY_LINKED_INTENTS } from "@/src/lib/types/intent.types";
import type { Clarification } from "@/src/services/attio/schema-types";

/**
 * Build confirmation keyboard for AI suggestion.
 *
 * When clarifications have options (e.g., "List", "Company", "Person"),
 * show them as inline buttons instead of hiding behind "Answer questions".
 */
export function buildConfirmationKeyboard(
  clarifications: Clarification[],
  intent?: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const firstClarification = clarifications[0];
  const hasOptions = firstClarification?.options && firstClarification.options.length > 0;

  // If we have clarifications with options, show them inline
  if (hasOptions && firstClarification.options) {
    // Add inline option buttons (max 3 per row for readability)
    const options = firstClarification.options.slice(0, 6);
    for (let i = 0; i < options.length; i++) {
      keyboard.text(options[i], buildCallbackData(CallbackAction.CLARIFY_OPTION, options[i]));
      // New row after every 3 buttons
      if ((i + 1) % 3 === 0 && i < options.length - 1) {
        keyboard.row();
      }
    }
    keyboard.row();
  }

  // Show confirm button
  if (clarifications.length > 0) {
    keyboard.text("✅ Create anyway", CallbackAction.CONFIRM);
    // If clarifications but no predefined options, show "Answer questions"
    if (!hasOptions) {
      keyboard.text("💬 Answer questions", CallbackAction.CLARIFY);
    }
  } else {
    keyboard.text("✅ Create", CallbackAction.CONFIRM).text("✏️ Edit", CallbackAction.EDIT);
  }

  keyboard.row();

  // Add "Change company" for records that link to companies
  if (intent && COMPANY_LINKED_INTENTS.includes(intent as AttioIntent)) {
    keyboard.text("🏢 Change company", buildCallbackData(CallbackAction.EDIT_FIELD, "company"));
    keyboard.row();
  }

  // Add "Change assignee" for tasks
  if (intent === AttioIntent.CREATE_TASK) {
    keyboard.text("👤 Change assignee", buildCallbackData(CallbackAction.EDIT_FIELD, "assignee"));
    keyboard.row();
  }

  keyboard.text("❌ Cancel", CallbackAction.CANCEL);

  return keyboard;
}

/**
 * Build keyboard for clarification questions.
 * Shows options if available, plus type/skip actions.
 */
export function buildClarificationKeyboard(options?: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (options && options.length > 0) {
    for (const option of options.slice(0, 5)) {
      keyboard.text(option, buildCallbackData(CallbackAction.CLARIFY_OPTION, option)).row();
    }
  }

  keyboard
    .text("⌨️ Type answer", buildCallbackData(CallbackAction.CLARIFY_OPTION, "__type__"))
    .text("⏭️ Skip", CallbackAction.SKIP)
    .row()
    .text("❌ Cancel", CallbackAction.CANCEL);

  return keyboard;
}

/**
 * Build keyboard for editing fields.
 * Shows editable fields from extracted data.
 */
export function buildEditFieldKeyboard(fields: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Show up to 2 fields per row
  for (let i = 0; i < fields.length; i += 2) {
    keyboard.text(fields[i], buildCallbackData(CallbackAction.EDIT_FIELD, fields[i]));
    if (fields[i + 1]) {
      keyboard.text(fields[i + 1], buildCallbackData(CallbackAction.EDIT_FIELD, fields[i + 1]));
    }
    keyboard.row();
  }

  keyboard.text("✅ Done editing", CallbackAction.CONFIRM).text("❌ Cancel", CallbackAction.CANCEL);

  return keyboard;
}
