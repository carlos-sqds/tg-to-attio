import type { CommandContext, Context } from "grammy";
import { getOrCreateSession, updateSession } from "@/src/lib/kv/session.kv";
import { fetchFullSchemaCached } from "@/src/workflows/attio.schema";
import { analyzeIntent, resolveAssignee } from "@/src/workflows/ai.intent";
import { buildConfirmationKeyboard, formatSuggestedAction } from "@/src/lib/telegram/keyboards";
import { withReactionCycling } from "@/src/lib/telegram/reactions";
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

  try {
    // Use reaction cycling while analyzing
    const { suggestedAction, schema } = await withReactionCycling(ctx, async () => {
      // Fetch schema if needed
      let schemaData = session.schema;
      if (!schemaData) {
        schemaData = await fetchFullSchemaCached();
      }

      // Analyze intent
      const action = await analyzeIntent({
        messages: session.messageQueue.map((m) => ({
          text: m.text,
          senderUsername: m.senderUsername,
          senderFirstName: m.senderFirstName,
          senderLastName: m.senderLastName,
          chatName: m.chatName,
          date: m.date,
        })),
        instruction,
        schema: schemaData,
      });

      // Resolve assignee for tasks
      if (action.intent === "create_task") {
        const assigneeName = String(
          action.extractedData.assignee || action.extractedData.assignee_name || ""
        );

        if (assigneeName || callerInfo) {
          const resolved = await resolveAssignee(
            assigneeName,
            callerInfo,
            schemaData.workspaceMembers,
            true // Default to caller if no assignee specified
          );

          if (resolved) {
            action.extractedData.assignee_id = resolved.memberId;
            action.extractedData.assignee = resolved.memberName;
          }
        }
      }

      return { suggestedAction: action, schema: schemaData };
    });

    // Format and send suggestion
    const suggestionText = formatSuggestedAction(suggestedAction);
    const keyboard = buildConfirmationKeyboard(
      suggestedAction.clarificationsNeeded,
      suggestedAction.intent
    );

    // Send suggestion as new message
    const suggestionMsg = await ctx.reply(suggestionText, {
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
      lastBotMessageId: suggestionMsg.message_id,
    });
  } catch (error) {
    console.error("[DONE] Error analyzing intent:", error);
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Failed to analyze"}`);
  }
}
