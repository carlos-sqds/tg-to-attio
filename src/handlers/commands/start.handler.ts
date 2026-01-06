import type { CommandContext, Context } from "grammy";
import { resetSession } from "@/src/lib/kv/session.kv";
import { WELCOME_TEXT } from "@/src/lib/telegram/commands";

/**
 * Handle /start command.
 * Creates a new session and sends welcome message.
 */
export async function handleStart(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;

  // Reset session (clears any existing state)
  await resetSession(chatId);

  // Send welcome message
  await ctx.reply(WELCOME_TEXT);
}
