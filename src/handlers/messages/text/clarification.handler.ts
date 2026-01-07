/**
 * Handler for awaiting_clarification state.
 * Processes user answers to clarification questions.
 */

import type { Context } from "grammy";
import { updateSession } from "@/src/lib/kv/session.kv";
import { processClarification } from "@/src/workflows/ai.intent";
import {
  buildConfirmationKeyboard,
  buildClarificationKeyboard,
  formatSuggestedAction,
} from "@/src/lib/telegram/keyboards";
import type { SessionState, ConversationState } from "@/src/lib/types/session.types";

type ClarificationState = Extract<ConversationState, { type: "awaiting_clarification" }>;

export async function handleClarificationState(
  ctx: Context,
  chatId: number,
  userId: number,
  text: string,
  session: SessionState,
  state: ClarificationState
): Promise<void> {
  const { index, questions } = state;
  const currentQuestion = questions[index];

  if (!currentQuestion || !session.currentAction || !session.schema) {
    await ctx.reply("❌ Session expired. Please start over with /done or /new");
    return;
  }

  try {
    const updatedAction = await processClarification(
      session.currentAction,
      currentQuestion.field,
      text,
      session.schema
    );

    // Check if there are more clarifications
    if (updatedAction.clarificationsNeeded.length > 0 && index + 1 < questions.length) {
      // Move to next question
      const nextIndex = index + 1;
      const nextQuestion = questions[nextIndex];

      const keyboard = buildClarificationKeyboard(nextQuestion.options);
      await ctx.reply(`❓ ${nextQuestion.question}`, { reply_markup: keyboard });

      await updateSession(chatId, userId, {
        state: {
          type: "awaiting_clarification",
          index: nextIndex,
          questions,
        },
        currentAction: updatedAction,
      });
    } else {
      // All clarifications answered, show updated suggestion
      const suggestionText = formatSuggestedAction(updatedAction);
      const keyboard = buildConfirmationKeyboard(false, updatedAction.intent);

      await ctx.reply(suggestionText, { reply_markup: keyboard });

      await updateSession(chatId, userId, {
        state: {
          type: "awaiting_confirmation",
          action: updatedAction,
        },
        currentAction: updatedAction,
      });
    }
  } catch (error) {
    console.error("[TEXT] Error processing clarification:", error);
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Failed to process"}`);
  }
}
