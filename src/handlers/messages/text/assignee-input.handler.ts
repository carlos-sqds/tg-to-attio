/**
 * Handler for awaiting_assignee_input state.
 * Resolves typed assignee name to workspace member.
 */

import type { Context } from "grammy";
import { updateSession } from "@/src/lib/kv/session.kv";
import { resolveAssignee } from "@/src/workflows/ai.intent";
import { buildConfirmationKeyboard, formatSuggestedAction } from "@/src/lib/telegram/keyboards";
import type { SessionState } from "@/src/lib/types/session.types";

export async function handleAssigneeInputState(
  ctx: Context,
  chatId: number,
  userId: number,
  text: string,
  session: SessionState
): Promise<void> {
  if (!session.currentAction || !session.schema) {
    await ctx.reply("❌ Session expired. Please start over.");
    return;
  }

  // Try to resolve the assignee name
  const resolved = await resolveAssignee(
    text,
    session.callerInfo,
    session.schema.workspaceMembers,
    false
  );

  if (resolved) {
    const updatedAction = {
      ...session.currentAction,
      extractedData: {
        ...session.currentAction.extractedData,
        assignee_id: resolved.memberId,
        assignee: resolved.memberName,
      },
    };

    const suggestionText = formatSuggestedAction(updatedAction);
    const keyboard = buildConfirmationKeyboard([], updatedAction.intent);

    await ctx.reply(`✅ Assignee set to ${resolved.memberName}\n\n${suggestionText}`, {
      reply_markup: keyboard,
    });

    await updateSession(chatId, userId, {
      state: {
        type: "awaiting_confirmation",
        action: updatedAction,
      },
      currentAction: updatedAction,
    });
  } else {
    await ctx.reply(
      `❌ Could not find "${text}" in workspace members.\n\n` +
        "Please try again or use /cancel to start over."
    );
  }
}
