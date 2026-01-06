/**
 * Telegram bot command identifiers.
 * Use these typed constants instead of magic strings.
 */
export const TelegramCommand = {
  START: "start",
  DONE: "done",
  NEW: "new",
  CLEAR: "clear",
  CANCEL: "cancel",
  HELP: "help",
} as const;

export type TelegramCommand = (typeof TelegramCommand)[keyof typeof TelegramCommand];

/**
 * Help text for the bot.
 */
export const HELP_TEXT = `🤖 AI-powered Attio Bot

✨ What I can do:
• Create contacts, companies, and deals
• Add records to lists and pipelines
• Create tasks with assignees and due dates
• Add notes to any record
• Auto-extract names, emails, phones, values

📋 How to use:

🆕 Direct create (no forwarding):
/new create task for John to call Acme
/new add company TechCorp
/new person Jane from TechCorp
/new deal $50k with Acme

⚡ Quick capture (single message):
Forward a message + add instruction as caption

📦 Batch capture (multiple messages):
1️⃣ Forward messages from any conversation
2️⃣ /done create a contact
3️⃣ Review and confirm

Commands:
• /new <instruction> - Create directly
• /done <instruction> - Process forwarded messages
• /clear - Clear message queue
• /cancel - Cancel current operation
• /help - Show this help`;

/**
 * Welcome message when starting a new session.
 */
export const WELCOME_TEXT = `🤖 Welcome to the AI-powered Attio Bot!

${HELP_TEXT.split("📋 How to use:")[1] || HELP_TEXT}`;
