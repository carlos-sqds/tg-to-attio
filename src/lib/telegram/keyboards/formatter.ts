/**
 * Format suggested actions for display in Telegram messages.
 */

import type { SuggestedAction } from "@/src/services/attio/schema-types";
import { INTENT_EMOJIS, INTENT_LABELS, isAttioIntent } from "@/src/lib/types/intent.types";

/**
 * Field display configuration for extracted data.
 */
const FIELD_CONFIG: Record<string, { label: string; priority: number }> = {
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

/**
 * Fields to skip when displaying extracted data.
 */
const SKIP_FIELDS = new Set([
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
  "search_results",
  "target_type",
  "original_target",
]);

/**
 * Date fields that should be formatted as readable dates.
 */
const DATE_FIELDS = ["deadline_at", "deadline", "due_date", "date"];

function getIntentLabel(intent: string): string {
  if (isAttioIntent(intent)) {
    return `${INTENT_EMOJIS[intent]} ${INTENT_LABELS[intent]}`;
  }
  return intent;
}

function getIntentEmoji(intent: string): string {
  if (isAttioIntent(intent)) {
    return INTENT_EMOJIS[intent];
  }
  return "•";
}

function formatValue(key: string, value: unknown): string | null {
  if (!value) return null;

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
  if (DATE_FIELDS.includes(key) && displayValue.match(/^\d{4}-\d{2}-\d{2}/)) {
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
    return displayValue;
  }
  return null;
}

/**
 * Format suggested action for display.
 * Returns Markdown-formatted text.
 */
export function formatSuggestedAction(action: SuggestedAction): string {
  let text = `${getIntentLabel(action.intent)}\n\n`;

  // Collect and sort fields
  const fields: Array<{ key: string; label: string; value: string; priority: number }> = [];

  for (const [key, value] of Object.entries(action.extractedData)) {
    if (SKIP_FIELDS.has(key)) continue;

    const formattedValue = formatValue(key, value);
    if (!formattedValue) continue;

    const config = FIELD_CONFIG[key] || { label: key.replace(/_/g, " "), priority: 99 };
    fields.push({ key, label: config.label, value: formattedValue, priority: config.priority });
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
