import type { CommandContext, Context } from "grammy";
import { getOrCreateSession, updateSession } from "@/src/lib/kv/session.kv";
import { fetchFullSchemaCached } from "@/src/workflows/attio.schema";
import { analyzeIntent, resolveAssignee } from "@/src/workflows/ai.intent";
import { buildConfirmationKeyboard, formatSuggestedAction } from "@/src/lib/telegram/keyboards";
import type { CallerInfo } from "@/src/lib/types/session.types";

/**
 * Handle /new command.
 * Creates directly from instruction without forwarding messages.
 */
export async function handleNew(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const userId = ctx.from?.id;
  if (!userId) return;

  const instruction = ctx.match?.toString().trim() || "";

  if (!instruction) {
    await ctx.reply(
      "💡 What should I create?\n\n" +
        "Examples:\n" +
        "• /new create task for John to call Acme\n" +
        "• /new add company TechCorp\n" +
        "• /new person Jane from TechCorp\n" +
        "• /new deal $50k with Acme"
    );
    return;
  }

  // Get caller info for "me" resolution
  const callerInfo: CallerInfo = {
    userId,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
    username: ctx.from?.username,
  };

  // Send processing message
  const processingMsg = await ctx.reply("🤔 Analyzing...");

  try {
    // Get or create session
    const session = await getOrCreateSession(chatId, userId);

    // Fetch schema if needed
    let schema = session.schema;
    if (!schema) {
      schema = await fetchFullSchemaCached();
    }

    // Analyze intent (no messages, just instruction)
    const suggestedAction = await analyzeIntent({
      messages: [],
      instruction,
      schema,
    });

    // Resolve assignee for tasks
    if (suggestedAction.intent === "create_task") {
      const assigneeName = String(
        suggestedAction.extractedData.assignee || suggestedAction.extractedData.assignee_name || ""
      );

      if (assigneeName || callerInfo) {
        const resolved = await resolveAssignee(
          assigneeName,
          callerInfo,
          schema.workspaceMembers,
          true // Default to caller if no assignee specified
        );

        if (resolved) {
          suggestedAction.extractedData.assignee_id = resolved.memberId;
          suggestedAction.extractedData.assignee = resolved.memberName;
        }
      }
    }

    // Format and send suggestion
    const suggestionText = formatSuggestedAction(suggestedAction);
    const keyboard = buildConfirmationKeyboard(
      suggestedAction.clarificationsNeeded,
      suggestedAction.intent
    );

    // Edit processing message with suggestion
    await ctx.api.editMessageText(chatId, processingMsg.message_id, suggestionText, {
      reply_markup: keyboard,
    });

    // Update session with suggested action (clear any old queue)
    await updateSession(chatId, userId, {
      state: {
        type: "awaiting_confirmation",
        action: suggestedAction,
      },
      messageQueue: [], // Clear queue for /new
      currentAction: suggestedAction,
      currentInstruction: instruction,
      callerInfo,
      initiatingUserId: userId,
      schema,
      lastBotMessageId: processingMsg.message_id,
    });
  } catch (error) {
    console.error("[NEW] Error analyzing intent:", error);
    await ctx.api.editMessageText(
      chatId,
      processingMsg.message_id,
      `❌ Error: ${error instanceof Error ? error.message : "Failed to analyze"}`
    );
  }
}
