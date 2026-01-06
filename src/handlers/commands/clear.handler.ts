import type { CommandContext, Context } from "grammy";
import { getSession, updateSession } from "@/src/lib/kv/session.kv";

/**
 * Handle /clear command.
 * Clears the message queue without changing state.
 */
export async function handleClear(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = await getSession(chatId, userId);

  if (!session || session.messageQueue.length === 0) {
    await ctx.reply("📭 No messages in queue.");
    return;
  }

  const count = session.messageQueue.length;

  // Clear the queue
  await updateSession(chatId, userId, {
    messageQueue: [],
    state: { type: "idle" },
    currentAction: null,
    currentInstruction: null,
    initiatingUserId: null,
  });

  await ctx.reply(`🗑️ Cleared ${count} message${count === 1 ? "" : "s"} from queue.`);
}
