import { config } from "@/src/lib/config";
import { logger } from "@/src/lib/logger";

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${config.botToken}`;

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface SendMessageOptions {
  chatId: number;
  text: string;
  parseMode?: "Markdown" | "HTML";
  replyMarkup?: {
    inline_keyboard: InlineKeyboardButton[][];
  };
}

interface EditMessageOptions {
  chatId: number;
  messageId: number;
  text: string;
  parseMode?: "Markdown" | "HTML";
  replyMarkup?: {
    inline_keyboard: InlineKeyboardButton[][];
  };
}

async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Telegram API error", { method, status: response.status, body: errorBody });
    throw new Error(`Telegram API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function sendMessage(options: SendMessageOptions): Promise<number> {
  "use step";

  const body: Record<string, unknown> = {
    chat_id: options.chatId,
    text: options.text,
  };

  if (options.parseMode) {
    body.parse_mode = options.parseMode;
  }

  if (options.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  const result = await telegramRequest<{ result: { message_id: number } }>("sendMessage", body);
  return result.result.message_id;
}

export async function editMessage(options: EditMessageOptions): Promise<void> {
  "use step";

  const body: Record<string, unknown> = {
    chat_id: options.chatId,
    message_id: options.messageId,
    text: options.text,
  };

  if (options.parseMode) {
    body.parse_mode = options.parseMode;
  }

  if (options.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  await telegramRequest("editMessageText", body);
}

export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  "use step";
  await telegramRequest("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

export async function setMessageReaction(
  chatId: number,
  messageId: number,
  emoji: string | null
): Promise<void> {
  "use step";
  
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    reaction: emoji ? [{ type: "emoji", emoji }] : [],
  };

  try {
    await telegramRequest("setMessageReaction", body);
  } catch (error) {
    // Reactions might fail if bot doesn't have permission - silently ignore
    logger.info("Could not set reaction", { error: String(error) });
  }
}

export function buildCompanySelectionKeyboard(
  recentCompanies: Array<{ id: string; name: string }>
): InlineKeyboardButton[][] {
  const keyboard: InlineKeyboardButton[][] = [];

  if (recentCompanies.length > 0) {
    for (const company of recentCompanies.slice(0, 5)) {
      keyboard.push([{ text: `🏢 ${company.name}`, callback_data: `select:${company.id}` }]);
    }
  }

  keyboard.push([{ text: "🔍 Search company", callback_data: "search" }]);
  keyboard.push([{ text: "❌ Cancel", callback_data: "cancel" }]);

  return keyboard;
}

export function buildSearchResultsKeyboard(
  companies: Array<{ id: string; name: string; location?: string }>
): InlineKeyboardButton[][] {
  const keyboard: InlineKeyboardButton[][] = [];

  for (const company of companies.slice(0, 5)) {
    const label = company.location ? `${company.name} - ${company.location}` : company.name;
    keyboard.push([{ text: label, callback_data: `select:${company.id}` }]);
  }

  keyboard.push([
    { text: "🔍 Search again", callback_data: "search" },
    { text: "❌ Cancel", callback_data: "cancel" },
  ]);

  return keyboard;
}

export function buildConfirmationKeyboard(): InlineKeyboardButton[][] {
  return [
    [
      { text: "✓ Confirm", callback_data: "confirm" },
      { text: "← Back", callback_data: "back" },
      { text: "❌ Cancel", callback_data: "cancel" },
    ],
  ];
}

// ============ AI SUGGESTION KEYBOARDS ============

export function buildAISuggestionKeyboard(hasClarifications: boolean): InlineKeyboardButton[][] {
  const keyboard: InlineKeyboardButton[][] = [];

  if (hasClarifications) {
    keyboard.push([
      { text: "✅ Create anyway", callback_data: "ai_confirm" },
      { text: "💬 Answer questions", callback_data: "ai_clarify" },
    ]);
  } else {
    keyboard.push([
      { text: "✅ Create", callback_data: "ai_confirm" },
      { text: "✏️ Edit", callback_data: "ai_edit" },
    ]);
  }

  keyboard.push([{ text: "❌ Cancel", callback_data: "cancel" }]);

  return keyboard;
}

export function buildClarificationKeyboard(
  options?: string[]
): InlineKeyboardButton[][] {
  const keyboard: InlineKeyboardButton[][] = [];

  if (options && options.length > 0) {
    for (const option of options.slice(0, 5)) {
      keyboard.push([{ text: option, callback_data: `clarify_option:${option}` }]);
    }
  }

  keyboard.push([
    { text: "⌨️ Type answer", callback_data: "clarify_type" },
    { text: "⏭️ Skip", callback_data: "clarify_skip" },
  ]);
  keyboard.push([{ text: "❌ Cancel", callback_data: "cancel" }]);

  return keyboard;
}

export function buildEditFieldKeyboard(
  fields: string[]
): InlineKeyboardButton[][] {
  const keyboard: InlineKeyboardButton[][] = [];

  // Show up to 3 fields per row
  for (let i = 0; i < fields.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    row.push({ text: fields[i], callback_data: `edit_field:${fields[i]}` });
    if (fields[i + 1]) {
      row.push({ text: fields[i + 1], callback_data: `edit_field:${fields[i + 1]}` });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: "✅ Done editing", callback_data: "ai_confirm" },
    { text: "❌ Cancel", callback_data: "cancel" },
  ]);

  return keyboard;
}

export function buildSearchResultSelectionKeyboard(
  results: Array<{ id: string; name: string; extra?: string }>
): InlineKeyboardButton[][] {
  const keyboard: InlineKeyboardButton[][] = [];

  for (const result of results.slice(0, 5)) {
    const label = result.extra ? `${result.name} (${result.extra})` : result.name;
    keyboard.push([{ text: label, callback_data: `select_record:${result.id}` }]);
  }

  keyboard.push([
    { text: "➕ Create new", callback_data: "create_new" },
    { text: "❌ Cancel", callback_data: "cancel" },
  ]);

  return keyboard;
}

// ============ MESSAGE FORMATTERS ============

function escapeMarkdown(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

export function formatSuggestedAction(action: {
  intent: string;
  extractedData: Record<string, unknown>;
  noteTitle: string;
  clarificationsNeeded: Array<{ field: string; question: string }>;
  confidence: number;
  prerequisiteActions?: Array<{ intent: string; extractedData: Record<string, unknown> }>;
}): string {
  const intentLabels: Record<string, string> = {
    create_person: "👤 Create Person",
    create_company: "🏢 Create Company",
    create_deal: "💰 Create Deal",
    create_task: "📋 Create Task",
    add_note: "📝 Add Note",
    add_to_list: "📋 Add to List",
  };

  const intentEmojis: Record<string, string> = {
    create_person: "👤",
    create_company: "🏢",
    create_deal: "💰",
    create_task: "📋",
    add_note: "📝",
    add_to_list: "📋",
  };

  // Field display configuration
  const fieldConfig: Record<string, { label: string; priority: number }> = {
    name: { label: "Name", priority: 1 },
    content: { label: "Task", priority: 1 },
    email_addresses: { label: "Email", priority: 2 },
    phone_numbers: { label: "Phone", priority: 3 },
    company: { label: "Company", priority: 4 },
    associated_company: { label: "Company", priority: 4 },
    domains: { label: "Domain", priority: 5 },
    primary_location: { label: "Location", priority: 6 },
    value: { label: "Value", priority: 2 },
    stage: { label: "Stage", priority: 3 },
    assignee: { label: "Assignee", priority: 2 },
    deadline_at: { label: "Deadline", priority: 3 },
    deadline: { label: "Deadline", priority: 3 },
    description: { label: "Description", priority: 10 },
    job_title: { label: "Title", priority: 5 },
  };

  // Skip these internal fields
  const skipFields = new Set(["noteTitle", "linked_record_id", "linked_record_object", "assignee_email", "assignee_id"]);

  let text = `${intentLabels[action.intent] || action.intent}\n`;
  text += "━━━━━━━━━━━━━━━━━━━━\n";

  // Collect and sort fields
  const fields: Array<{ key: string; label: string; value: string; priority: number }> = [];

  for (const [key, value] of Object.entries(action.extractedData)) {
    if (!value || skipFields.has(key)) continue;
    
    const config = fieldConfig[key] || { label: key.replace(/_/g, " "), priority: 99 };
    let displayValue: string;

    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.amount !== undefined && obj.amount !== null) {
        displayValue = `$${Number(obj.amount).toLocaleString()} ${obj.currency || "USD"}`;
      } else {
        displayValue = JSON.stringify(value);
      }
    } else {
      displayValue = String(value);
    }

    if (displayValue && displayValue !== "undefined" && displayValue !== "null") {
      fields.push({ key, label: config.label, value: displayValue, priority: config.priority });
    }
  }

  // Sort by priority and display
  fields.sort((a, b) => a.priority - b.priority);
  for (const field of fields) {
    text += `${field.label}: ${escapeMarkdown(field.value)}\n`;
  }

  // Show prerequisite actions if any
  if (action.prerequisiteActions && action.prerequisiteActions.length > 0) {
    text += "\n📦 Will also create:\n";
    for (const prereq of action.prerequisiteActions) {
      const emoji = intentEmojis[prereq.intent] || "•";
      const name = prereq.extractedData.name || prereq.extractedData.content || "item";
      text += `${emoji} ${escapeMarkdown(String(name))}\n`;
    }
  }

  text += `\n📎 ${escapeMarkdown(action.noteTitle)}`;

  // Show clarifications needed
  if (action.clarificationsNeeded.length > 0) {
    text += `\n\n⚠️ Need info:\n`;
    for (const c of action.clarificationsNeeded) {
      text += `• ${escapeMarkdown(c.question)}\n`;
    }
  }

  return text;
}
