/**
 * Handler for idle and gathering_messages states.
 * Stores text as pending instruction for forward correlation.
 */

import type { Context } from "grammy";
import { setPending } from "@/src/lib/kv/pending.kv";
import type { CallerInfo, SessionState } from "@/src/lib/types/session.types";

export async function handleIdleState(
  ctx: Context,
  chatId: number,
  userId: number,
  text: string,
  session: SessionState | null
): Promise<void> {
  const callerInfo: CallerInfo = {
    userId,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
    username: ctx.from?.username,
  };

  await setPending(chatId, userId, text, ctx.message!.message_id, callerInfo);

  if (session && session.messageQueue.length > 0) {
    await ctx.reply(
      `📦 You have ${session.messageQueue.length} message(s) in queue.\n\n` +
        `Use /done ${text} to process them.`
    );
  } else {
    await ctx.reply(
      "💡 Got your instruction. Now forward a message within 2 seconds, " +
        "or use:\n\n/new " +
        text
    );
  }
}
