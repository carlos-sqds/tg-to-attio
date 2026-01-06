import type { CommandContext, Context } from "grammy";
import { HELP_TEXT } from "@/src/lib/telegram/commands";

/**
 * Handle /help command.
 * Sends help message with available commands.
 */
export async function handleHelp(ctx: CommandContext<Context>): Promise<void> {
  await ctx.reply(HELP_TEXT);
}
