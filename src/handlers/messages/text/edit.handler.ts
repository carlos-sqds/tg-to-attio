/**
 * Handler for awaiting_edit state.
 * Processes user's new value for a field being edited.
 */

import type { Context } from "grammy";
import { updateSession } from "@/src/lib/kv/session.kv";
import { buildConfirmationKeyboard, formatSuggestedAction } from "@/src/lib/telegram/keyboards";
import type { SessionState, ConversationState } from "@/src/lib/types/session.types";

type EditState = Extract<ConversationState, { type: "awaiting_edit" }>;

export async function handleEditState(
  ctx: Context,
  chatId: number,
  userId: number,
  text: string,
  session: SessionState,
  state: EditState
): Promise<void> {
  const { field } = state;

  if (!session.currentAction) {
    await ctx.reply("❌ Session expired. Please start over.");
    return;
  }

  // Update the field value
  const updatedAction = {
    ...session.currentAction,
    extractedData: {
      ...session.currentAction.extractedData,
      [field]: text,
    },
  };

  // Show updated suggestion
  const suggestionText = formatSuggestedAction(updatedAction);
  const keyboard = buildConfirmationKeyboard([], updatedAction.intent);

  await ctx.reply(suggestionText, { reply_markup: keyboard });

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_confirmation",
      action: updatedAction,
    },
    currentAction: updatedAction,
  });
}
