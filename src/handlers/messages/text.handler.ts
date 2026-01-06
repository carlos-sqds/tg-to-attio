import type { Context } from "grammy";
import { getSession, updateSession } from "@/src/lib/kv/session.kv";
import { setPending } from "@/src/lib/kv/pending.kv";
import { processClarification } from "@/src/workflows/ai.intent";
import {
  buildConfirmationKeyboard,
  buildClarificationKeyboard,
  formatSuggestedAction,
} from "@/src/lib/telegram/keyboards";
import type { CallerInfo } from "@/src/lib/types/session.types";

/**
 * Handle text messages.
 * Routes based on current session state.
 */
export async function handleText(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;
  if (!chatId || !text) return;

  // Get session
  const session = await getSession(chatId);
  if (!session) {
    // No session, might be instruction before forward
    const callerInfo: CallerInfo = {
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      username: ctx.from?.username,
    };

    // Store as pending instruction
    await setPending(chatId, text, ctx.message.message_id, callerInfo);

    await ctx.reply(
      "💡 Got your instruction. Now forward a message within 2 seconds, " +
        "or use:\n\n/new " +
        text
    );
    return;
  }

  // Route based on state
  switch (session.state.type) {
    case "idle":
    case "gathering_messages": {
      // Might be instruction before forward
      const callerInfo: CallerInfo = {
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        username: ctx.from?.username,
      };

      await setPending(chatId, text, ctx.message.message_id, callerInfo);

      if (session.messageQueue.length > 0) {
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
      break;
    }

    case "awaiting_clarification": {
      // User is answering a clarification question
      const { index, questions } = session.state;
      const currentQuestion = questions[index];

      if (!currentQuestion || !session.currentAction || !session.schema) {
        await ctx.reply("❌ Session expired. Please start over with /done or /new");
        return;
      }

      // Process clarification with AI
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

          await updateSession(chatId, {
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

          await updateSession(chatId, {
            state: {
              type: "awaiting_confirmation",
              action: updatedAction,
            },
            currentAction: updatedAction,
          });
        }
      } catch (error) {
        console.error("[TEXT] Error processing clarification:", error);
        await ctx.reply(
          `❌ Error: ${error instanceof Error ? error.message : "Failed to process"}`
        );
      }
      break;
    }

    case "awaiting_edit": {
      // User is editing a field value
      const { field } = session.state;

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
      const keyboard = buildConfirmationKeyboard(false, updatedAction.intent);

      await ctx.reply(suggestionText, { reply_markup: keyboard });

      await updateSession(chatId, {
        state: {
          type: "awaiting_confirmation",
          action: updatedAction,
        },
        currentAction: updatedAction,
      });
      break;
    }

    case "awaiting_assignee_input": {
      // User is typing an assignee name
      if (!session.currentAction || !session.schema) {
        await ctx.reply("❌ Session expired. Please start over.");
        return;
      }

      // Try to resolve the assignee name
      const { resolveAssignee } = await import("@/src/workflows/ai.intent");
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
        const keyboard = buildConfirmationKeyboard(false, updatedAction.intent);

        await ctx.reply(`✅ Assignee set to ${resolved.memberName}\n\n${suggestionText}`, {
          reply_markup: keyboard,
        });

        await updateSession(chatId, {
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
      break;
    }

    case "awaiting_note_parent_search": {
      // User is searching for a note parent
      const { parentType } = session.state;
      const { searchRecords } = await import("@/src/workflows/attio.actions");
      const { buildNoteParentSearchResultsKeyboard } = await import("@/src/lib/telegram/keyboards");

      const results = await searchRecords(parentType, text);

      if (results.length === 0) {
        await ctx.reply(`❌ No ${parentType} found matching "${text}".\n\nTry again or /cancel.`);
      } else {
        const keyboard = buildNoteParentSearchResultsKeyboard(results);
        await ctx.reply(`Found ${results.length} result(s):`, { reply_markup: keyboard });

        await updateSession(chatId, {
          state: {
            type: "awaiting_note_parent_selection",
            results,
          },
        });
      }
      break;
    }

    default:
      // Unexpected state, suggest starting over
      await ctx.reply(
        "🤔 I'm not sure what to do with that.\n\n" +
          "Use /help to see available commands, or /cancel to start over."
      );
  }
}
