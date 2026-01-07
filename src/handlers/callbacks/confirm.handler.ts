import type { Context } from "grammy";
import { getSession, resetSession, updateSession } from "@/src/lib/kv/session.kv";
import { executeActionWithNote } from "@/src/workflows/attio.actions";
import { resolveAssignee } from "@/src/workflows/ai.intent";
import { formatMessagesForSingleNote } from "@/src/services/attio/formatters";

/**
 * Handle confirm callback.
 * Executes the suggested action.
 */
export async function handleConfirm(ctx: Context): Promise<void> {
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

  await ctx.answerCallbackQuery();

  // Show processing message
  await ctx.editMessageText("⏳ Creating...");

  try {
    // Format messages for note
    const formatted = formatMessagesForSingleNote(session.messageQueue);

    // Resolve caller's email for ownership (deals, etc.)
    let callerEmail: string | undefined;
    if (session.callerInfo && session.schema) {
      const resolved = await resolveAssignee(
        "",
        session.callerInfo,
        session.schema.workspaceMembers,
        true
      );
      callerEmail = resolved?.email;
    }

    // Execute the action
    const result = await executeActionWithNote(
      {
        intent: session.currentAction.intent,
        extractedData: session.currentAction.extractedData,
        noteTitle: session.currentAction.noteTitle,
        targetObject: session.currentAction.targetObject,
        targetList: session.currentAction.targetList,
        prerequisiteActions: session.currentAction.prerequisiteActions,
        originalInstruction: session.currentInstruction || undefined,
        callerEmail,
      },
      formatted.content
    );

    if (result.success) {
      let successMsg = "✅ Created successfully!";

      // Add link to main record
      if (result.recordUrl) {
        successMsg += `\n\n🔗 [View in Attio](${result.recordUrl})`;
      }

      // Add links to created prerequisites
      if (result.createdPrerequisites && result.createdPrerequisites.length > 0) {
        successMsg += "\n\n📦 Also created:";
        for (const prereq of result.createdPrerequisites) {
          if (prereq.url) {
            successMsg += `\n• [${prereq.name}](${prereq.url})`;
          } else {
            successMsg += `\n• ${prereq.name}`;
          }
        }
      }

      await ctx.editMessageText(successMsg, { parse_mode: "Markdown" });

      // Reset session
      await resetSession(chatId, userId);
    } else {
      await ctx.editMessageText(`❌ Failed: ${result.error}`);
    }
  } catch (error) {
    console.error("[CONFIRM] Error executing action:", error);
    await ctx.editMessageText(
      `❌ Error: ${error instanceof Error ? error.message : "Failed to create"}`
    );
  }
}

/**
 * Handle cancel callback.
 * Cancels the current operation and resets session.
 */
export async function handleCancel(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  // Users can cancel their own sessions (no validation needed - cancel is safe for anyone)
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("❌ Operation cancelled.");
  await resetSession(chatId, userId);
}

/**
 * Handle skip callback.
 * Skips the current clarification/step.
 */
export async function handleSkip(ctx: Context): Promise<void> {
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

  await ctx.answerCallbackQuery();

  // Just confirm with current values
  const { buildConfirmationKeyboard, formatSuggestedAction } =
    await import("@/src/lib/telegram/keyboards");

  const suggestionText = formatSuggestedAction(session.currentAction);
  const keyboard = buildConfirmationKeyboard([], session.currentAction.intent);

  await ctx.editMessageText(suggestionText, { reply_markup: keyboard });

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_confirmation",
      action: session.currentAction,
    },
  });
}
