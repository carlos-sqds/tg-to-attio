import type { Context } from "grammy";
import { getSession, updateSession } from "@/src/lib/kv/session.kv";
import { buildClarificationKeyboard } from "@/src/lib/telegram/keyboards";

/**
 * Handle clarify callback.
 * Shows clarification questions for the user to answer.
 */
export async function handleClarify(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);
  if (!session || !session.currentAction) {
    await ctx.answerCallbackQuery("Session expired. Please start over.");
    return;
  }

  // Validate that the user clicking the button is the one who initiated the action
  if (session.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  const clarifications = session.currentAction.clarificationsNeeded;
  if (clarifications.length === 0) {
    await ctx.answerCallbackQuery("No clarifications needed");
    return;
  }

  await ctx.answerCallbackQuery();

  // Show first clarification question
  const firstQuestion = clarifications[0];
  const keyboard = buildClarificationKeyboard(firstQuestion.options);

  await ctx.editMessageText(`❓ ${firstQuestion.question}`, {
    reply_markup: keyboard,
  });

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_clarification",
      index: 0,
      questions: clarifications,
    },
  });
}

/**
 * Handle clarification option callback.
 * Processes the selected option for a clarification question.
 */
export async function handleClarifyOption(ctx: Context, option: string): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);
  if (!session?.state || session.state.type !== "awaiting_clarification") {
    await ctx.answerCallbackQuery("Session expired. Please start over.");
    return;
  }

  // Validate that the user clicking the button is the one who initiated the action
  if (session.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  await ctx.answerCallbackQuery();

  const { index, questions } = session.state;
  const currentQuestion = questions[index];

  if (!currentQuestion || !session.currentAction || !session.schema) {
    await ctx.editMessageText("❌ Session expired. Please start over.");
    return;
  }

  // Special handling for "type" option
  if (option === "__type__") {
    await ctx.editMessageText(`💬 Please type your answer for: ${currentQuestion.question}`);
    return; // Stay in awaiting_clarification state, text handler will pick it up
  }

  // Process clarification with AI
  try {
    const { processClarification } = await import("@/src/workflows/ai.intent");
    const updatedAction = await processClarification(
      session.currentAction,
      currentQuestion.field,
      option,
      session.schema
    );

    // Check if there are more clarifications
    if (index + 1 < questions.length) {
      // Move to next question
      const nextIndex = index + 1;
      const nextQuestion = questions[nextIndex];

      const keyboard = buildClarificationKeyboard(nextQuestion.options);
      await ctx.editMessageText(`❓ ${nextQuestion.question}`, { reply_markup: keyboard });

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
      const { buildConfirmationKeyboard, formatSuggestedAction } =
        await import("@/src/lib/telegram/keyboards");

      const suggestionText = formatSuggestedAction(updatedAction);
      const keyboard = buildConfirmationKeyboard(false, updatedAction.intent);

      await ctx.editMessageText(suggestionText, { reply_markup: keyboard });

      await updateSession(chatId, userId, {
        state: {
          type: "awaiting_confirmation",
          action: updatedAction,
        },
        currentAction: updatedAction,
      });
    }
  } catch (error) {
    console.error("[CLARIFY] Error processing clarification:", error);
    await ctx.editMessageText(
      `❌ Error: ${error instanceof Error ? error.message : "Failed to process"}`
    );
  }
}
