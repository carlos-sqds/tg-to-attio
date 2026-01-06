import type { CommandContext, Context } from "grammy";
import { getOrCreateSession, updateSession } from "@/src/lib/kv/session.kv";
import { fetchFullSchemaCached } from "@/src/workflows/attio.schema";
import { analyzeIntent, resolveAssignee } from "@/src/workflows/ai.intent";
import { buildConfirmationKeyboard, formatSuggestedAction } from "@/src/lib/telegram/keyboards";
import type { CallerInfo } from "@/src/lib/types/session.types";

/**
 * Handle /done command.
 * Processes the message queue with AI and shows suggested action.
 */
export async function handleDone(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat.id;
  const userId = ctx.from?.id;
  if (!userId) return;

  const instruction = ctx.match?.toString().trim() || "";

  // Get session
  const session = await getOrCreateSession(chatId, userId);

  // Check if we have messages to process
  if (session.messageQueue.length === 0) {
    await ctx.reply(
      "📭 No messages in queue.\n\n" +
        "Forward some messages first, then use:\n" +
        "/done <instruction>\n\n" +
        "Or create directly:\n" +
        "/new <instruction>"
    );
    return;
  }

  if (!instruction) {
    await ctx.reply(
      "💡 What should I do with these messages?\n\n" +
        "Examples:\n" +
        "• /done create a person\n" +
        "• /done add company\n" +
        "• /done create task for John"
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
    // Fetch schema if needed
    let schema = session.schema;
    if (!schema) {
      schema = await fetchFullSchemaCached();
    }

    // Analyze intent
    const suggestedAction = await analyzeIntent({
      messages: session.messageQueue.map((m) => ({
        text: m.text,
        senderUsername: m.senderUsername,
        senderFirstName: m.senderFirstName,
        senderLastName: m.senderLastName,
        chatName: m.chatName,
        date: m.date,
      })),
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
      suggestedAction.clarificationsNeeded.length > 0,
      suggestedAction.intent
    );

    // Edit processing message with suggestion
    await ctx.api.editMessageText(chatId, processingMsg.message_id, suggestionText, {
      reply_markup: keyboard,
    });

    // Update session with suggested action
    await updateSession(chatId, userId, {
      state: {
        type: "awaiting_confirmation",
        action: suggestedAction,
      },
      currentAction: suggestedAction,
      currentInstruction: instruction,
      callerInfo,
      initiatingUserId: userId,
      schema,
      lastBotMessageId: processingMsg.message_id,
    });
  } catch (error) {
    console.error("[DONE] Error analyzing intent:", error);
    await ctx.api.editMessageText(
      chatId,
      processingMsg.message_id,
      `❌ Error: ${error instanceof Error ? error.message : "Failed to analyze"}`
    );
  }
}
