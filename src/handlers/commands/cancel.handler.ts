import type { CommandContext, Context } from "grammy";
import { resetSession } from "@/src/lib/kv/session.kv";

/**
 * Handle /cancel command.
 * Resets the session to idle state.
 */
export async function handleCancel(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const userId = ctx.from?.id;
  if (!userId) return;

  // Reset session to idle
  await resetSession(chatId, userId);

  await ctx.reply("❌ Operation cancelled. Send /start to begin again.");
}
