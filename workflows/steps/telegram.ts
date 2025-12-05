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
