import { InlineKeyboard } from "grammy";
import type { SuggestedAction, WorkspaceMember } from "@/src/services/attio/schema-types";
import type { SearchResult } from "@/src/lib/types/session.types";
import { CallbackAction, buildCallbackData } from "@/src/lib/types/callback.types";
import {
  AttioIntent,
  COMPANY_LINKED_INTENTS,
  INTENT_EMOJIS,
  INTENT_LABELS,
  isAttioIntent,
} from "@/src/lib/types/intent.types";

/**
 * Build confirmation keyboard for AI suggestion.
 * Shows confirm/edit or confirm/clarify based on state.
 */
export function buildConfirmationKeyboard(
  hasClarifications: boolean,
  intent?: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (hasClarifications) {
    keyboard
      .text("✅ Create anyway", CallbackAction.CONFIRM)
      .text("💬 Answer questions", CallbackAction.CLARIFY);
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

/**
 * Build keyboard for member/assignee selection.
 * Supports pagination for large member lists.
 */
export function buildAssigneeKeyboard(
  members: WorkspaceMember[],
  page: number = 0,
  pageSize: number = 5
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const totalPages = Math.ceil(members.length / pageSize);
  const startIdx = page * pageSize;
  const endIdx = Math.min(startIdx + pageSize, members.length);
  const pageMembers = members.slice(startIdx, endIdx);

  for (const member of pageMembers) {
    const label = `👤 ${member.firstName} ${member.lastName}`;
    keyboard.text(label, buildCallbackData(CallbackAction.ASSIGNEE_SELECT, member.id)).row();
  }

  // Add pagination if needed
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text("◀️ Prev", CallbackAction.ASSIGNEE_PREV);
    }
    keyboard.text(`${page + 1}/${totalPages}`, "noop");
    if (page < totalPages - 1) {
      keyboard.text("Next ▶️", CallbackAction.ASSIGNEE_NEXT);
    }
    keyboard.row();
  }

  keyboard
    .text("✏️ Type name", CallbackAction.ASSIGNEE_MANUAL)
    .row()
    .text("⏭️ Skip", CallbackAction.ASSIGNEE_SKIP)
    .text("❌ Cancel", CallbackAction.CANCEL);

  return keyboard;
}

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

/**
 * Format suggested action for display.
 * Returns Markdown-formatted text.
 */
export function formatSuggestedAction(action: SuggestedAction): string {
  // Use typed intent constants from intent.types.ts
  const getIntentLabel = (intent: string): string => {
    if (isAttioIntent(intent)) {
      return `${INTENT_EMOJIS[intent]} ${INTENT_LABELS[intent]}`;
    }
    return intent;
  };

  const getIntentEmoji = (intent: string): string => {
    if (isAttioIntent(intent)) {
      return INTENT_EMOJIS[intent];
    }
    return "•";
  };

  // Field display configuration
  const fieldConfig: Record<string, { label: string; priority: number }> = {
    name: { label: "Name", priority: 1 },
    content: { label: "Task", priority: 1 },
    title: { label: "Title", priority: 1 },
    note_content: { label: "Content", priority: 2 },
    parent_name: { label: "To", priority: 3 },
    email_addresses: { label: "Email", priority: 2 },
    phone_numbers: { label: "Phone", priority: 3 },
    company: { label: "Company", priority: 4 },
    associated_company: { label: "Company", priority: 4 },
    domains: { label: "Domain", priority: 5 },
    primary_location: { label: "Location", priority: 6 },
    value: { label: "Value", priority: 2 },
    assignee: { label: "Assignee", priority: 2 },
    deadline_at: { label: "Due", priority: 3 },
    deadline: { label: "Due", priority: 3 },
    due_date: { label: "Due", priority: 3 },
    description: { label: "Description", priority: 10 },
    job_title: { label: "Title", priority: 5 },
  };

  // Skip these internal/system fields
  const skipFields = new Set([
    "noteTitle",
    "linked_record_id",
    "linked_record_object",
    "assignee_email",
    "assignee_id",
    "stage",
    "owner",
    "ownerEmail",
    "owner_email",
    "product",
    "context",
    "parent_object",
    "parent_record_id",
  ]);

  let text = `${getIntentLabel(action.intent)}\n\n`;

  // Collect and sort fields
  const fields: Array<{ key: string; label: string; value: string; priority: number }> = [];

  for (const [key, value] of Object.entries(action.extractedData)) {
    if (!value || skipFields.has(key)) continue;

    const config = fieldConfig[key] || { label: key.replace(/_/g, " "), priority: 99 };
    let displayValue: string;

    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.amount !== undefined && obj.amount !== null) {
        displayValue = `$${Number(obj.amount).toLocaleString()} ${String(obj.currency || "USD")}`;
      } else {
        displayValue = JSON.stringify(value);
      }
    } else {
      displayValue = String(value);
    }

    // Format dates as readable dates
    const dateFields = ["deadline_at", "deadline", "due_date", "date"];
    if (dateFields.includes(key) && displayValue.match(/^\d{4}-\d{2}-\d{2}/)) {
      const date = new Date(displayValue);
      if (!isNaN(date.getTime())) {
        displayValue = date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        });
      }
    }

    if (displayValue && displayValue !== "undefined" && displayValue !== "null") {
      fields.push({ key, label: config.label, value: displayValue, priority: config.priority });
    }
  }

  // Sort by priority and display
  fields.sort((a, b) => a.priority - b.priority);
  for (const field of fields) {
    text += `${field.label}: ${field.value}\n`;
  }

  // Show prerequisite actions if any
  if (action.prerequisiteActions && action.prerequisiteActions.length > 0) {
    text += "\n📦 Will also create:\n";
    for (const prereq of action.prerequisiteActions) {
      const emoji = getIntentEmoji(prereq.intent);
      const name = prereq.extractedData.name || prereq.extractedData.content || "item";
      text += `${emoji} ${String(name)}\n`;
    }
  }

  text += `\n📎 ${action.noteTitle}`;

  // Show clarifications needed
  if (action.clarificationsNeeded.length > 0) {
    text += `\n\n⚠️ Need info:\n`;
    for (const c of action.clarificationsNeeded) {
      text += `• ${c.question}\n`;
    }
  }

  return text;
}
