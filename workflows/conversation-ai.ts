import { logger } from "@/src/lib/logger";
import type { ForwardedMessageData } from "@/src/types";
import type { SuggestedAction, AttioSchema } from "@/src/services/attio/schema-types";
import { telegramHook, type TelegramEvent } from "./hooks";
import {
  sendMessage,
  editMessage,
  answerCallbackQuery,
  setMessageReaction,
  buildAISuggestionKeyboard,
  buildClarificationKeyboard,
  buildEditFieldKeyboard,
  formatSuggestedAction,
} from "./steps/telegram";
import { analyzeIntent, processClarification } from "./steps/ai";
import { executeActionWithNote } from "./steps/attio-actions";
import { fetchFullSchemaCached } from "./steps/attio-schema";
import { formatMessagesForSingleNote } from "@/src/services/attio/formatters";

type ConversationState =
  | "idle"
  | "gathering_messages"
  | "awaiting_instruction"
  | "processing_ai"
  | "awaiting_confirmation"
  | "awaiting_clarification"
  | "awaiting_edit_value"
  | "executing";

export async function conversationWorkflowAI(userId: number, chatId: number) {
  "use workflow";

  let messageQueue: ForwardedMessageData[] = [];
  let currentAction: SuggestedAction | null = null;
  let schema: AttioSchema | null = null;
  let lastBotMessageId: number | null = null;
  let state: ConversationState = "idle";
  let currentClarificationIndex = 0;
  let editingField: string | null = null;
  let currentInstruction: string | null = null; // Store for date extraction

  // Send welcome message
  await sendMessage({
    chatId,
    text: `🤖 Welcome to the AI-powered Attio Bot!

📋 How it works:

1️⃣ Forward me messages from conversations
2️⃣ Send /done followed by what you want to do
   Examples:
   • /done create a contact
   • /done add this to TechCorp
   • /done create a deal for $50k
   • /done remind Sarah to follow up
3️⃣ Review my suggestion and confirm

Commands:
/done <instruction> - Process messages with AI
/clear - Clear message queue
/cancel - Cancel current operation
/help - Show this message`,
  });

  logger.info("AI Workflow started", { userId });

  const events = telegramHook.create({ token: `ai4-${userId}` });

  for await (const event of events) {
    try {
      logger.info("Processing event", { userId, eventType: event.type, state });

      // Handle callback queries
      if (event.type === "callback_query") {
        await answerCallbackQuery(event.callbackQueryId);
        const data = event.callbackData;

        // Cancel - always available
        if (data === "cancel") {
          messageQueue = [];
          currentAction = null;
          state = "idle";
          editingField = null;

          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "❌ Operation cancelled.",
            });
          }
          continue;
        }

        // AI Confirm - execute the action
        if (data === "ai_confirm" && currentAction) {
          state = "executing";

          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "⏳ Creating...",
            });
          }

          try {
            const formatted = formatMessagesForSingleNote(messageQueue);
            const result = await executeActionWithNote(
              {
                intent: currentAction.intent,
                extractedData: currentAction.extractedData,
                noteTitle: currentAction.noteTitle,
                targetObject: currentAction.targetObject,
                targetList: currentAction.targetList,
                prerequisiteActions: currentAction.prerequisiteActions,
                originalInstruction: currentInstruction || undefined,
              },
              formatted.content
            );

            if (result.success) {
              let successMsg = "✅ Created successfully!";
              
              // Add link to main record
              if (result.recordUrl) {
                successMsg += `\n\n🔗 [View in Attio](${result.recordUrl})`;
              }
              
              // Add links to created prerequisites (companies, people)
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

              if (lastBotMessageId) {
                await editMessage({
                  chatId,
                  messageId: lastBotMessageId,
                  text: successMsg,
                  parseMode: "Markdown",
                });
              }

              logger.info("Action executed", { 
                userId, 
                intent: currentAction.intent,
                recordId: result.recordId 
              });
            } else {
              if (lastBotMessageId) {
                await editMessage({
                  chatId,
                  messageId: lastBotMessageId,
                  text: `❌ Failed: ${result.error}`,
                });
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: `❌ Error: ${errorMsg}`,
              });
            }
          }

          messageQueue = [];
          currentAction = null;
          state = "idle";
          continue;
        }

        // AI Clarify - start answering questions
        if (data === "ai_clarify" && currentAction?.clarificationsNeeded.length) {
          state = "awaiting_clarification";
          currentClarificationIndex = 0;

          const clarification = currentAction.clarificationsNeeded[0];
          lastBotMessageId = await sendMessage({
            chatId,
            text: `❓ ${clarification.question}`,
            replyMarkup: {
              inline_keyboard: buildClarificationKeyboard(clarification.options),
            },
          });
          continue;
        }

        // AI Edit - choose field to edit
        if (data === "ai_edit" && currentAction) {
          const fields = Object.keys(currentAction.extractedData);
          lastBotMessageId = await sendMessage({
            chatId,
            text: "Which field would you like to edit?",
            replyMarkup: {
              inline_keyboard: buildEditFieldKeyboard(fields),
            },
          });
          continue;
        }

        // Change company for task
        if (data === "change_company" && currentAction) {
          editingField = "associated_company";
          state = "awaiting_edit_value";

          await sendMessage({
            chatId,
            text: "Which company should this task be linked to?\n\nType the company name (it will be created if it doesn't exist):",
          });
          continue;
        }

        // Edit specific field
        if (data.startsWith("edit_field:") && currentAction) {
          editingField = data.replace("edit_field:", "");
          state = "awaiting_edit_value";

          await sendMessage({
            chatId,
            text: `Enter new value for **${editingField}**:`,
            parseMode: "Markdown",
          });
          continue;
        }

        // Clarification option selected
        if (data.startsWith("clarify_option:") && currentAction) {
          const value = data.replace("clarify_option:", "");
          const clarification = currentAction.clarificationsNeeded[currentClarificationIndex];

          // Update extracted data with the clarification
          currentAction.extractedData[clarification.field] = value;
          currentAction.clarificationsNeeded.splice(currentClarificationIndex, 1);

          // Move to next clarification or show updated suggestion
          if (currentAction.clarificationsNeeded.length > 0) {
            const nextClarification = currentAction.clarificationsNeeded[0];
            currentClarificationIndex = 0;

            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: `❓ ${nextClarification.question}`,
                replyMarkup: {
                  inline_keyboard: buildClarificationKeyboard(nextClarification.options),
                },
              });
            }
          } else {
            // All clarifications answered, show updated suggestion
            state = "awaiting_confirmation";
            const suggestionText = formatSuggestedAction(currentAction);

            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: suggestionText,
                replyMarkup: {
                  inline_keyboard: buildAISuggestionKeyboard(false, currentAction.intent),
                },
              });
            }
          }
          continue;
        }

        // Type answer for clarification
        if (data === "clarify_type") {
          state = "awaiting_clarification";
          await sendMessage({
            chatId,
            text: "Type your answer:",
          });
          continue;
        }

        // Skip clarification
        if (data === "clarify_skip" && currentAction) {
          currentAction.clarificationsNeeded.splice(currentClarificationIndex, 1);

          if (currentAction.clarificationsNeeded.length > 0) {
            const nextClarification = currentAction.clarificationsNeeded[0];
            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: `❓ ${nextClarification.question}`,
                replyMarkup: {
                  inline_keyboard: buildClarificationKeyboard(nextClarification.options),
                },
              });
            }
          } else {
            state = "awaiting_confirmation";
            const suggestionText = formatSuggestedAction(currentAction);

            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: suggestionText,
                replyMarkup: {
                  inline_keyboard: buildAISuggestionKeyboard(false, currentAction.intent),
                },
              });
            }
          }
          continue;
        }

        continue;
      }

      // Handle commands
      if (event.type === "command") {
        const command = event.command;

        if (command === "/clear") {
          const count = messageQueue.length;
          messageQueue = [];
          currentAction = null;
          state = "idle";

          await sendMessage({
            chatId,
            text: count > 0 
              ? `🗑️ Cleared ${count} message(s).` 
              : "✨ Queue is already empty.",
          });
          continue;
        }

        if (command === "/cancel") {
          messageQueue = [];
          currentAction = null;
          state = "idle";

          await sendMessage({
            chatId,
            text: "❌ Operation cancelled.",
          });
          continue;
        }

        if (command === "/help") {
          await sendMessage({
            chatId,
            text: `🤖 **AI Attio Bot Help**

**Forward messages** from any chat, then use:

/done create a contact - Create a person
/done create company - Create a company  
/done create deal for X - Create a deal
/done add note to X - Add note to record
/done remind X to Y - Create a task

/clear - Clear queued messages
/cancel - Cancel current operation`,
            parseMode: "Markdown",
          });
          continue;
        }

        continue;
      }

      // Handle forwarded messages - queue them
      if (event.type === "forwarded_message" && event.forwardedMessage) {
        messageQueue.push(event.forwardedMessage);
        state = "gathering_messages";

        await sendMessage({
          chatId,
          text: `📥 Message queued (${messageQueue.length})\n\nForward more or send /done <instruction>`,
        });
        continue;
      }

      // Handle text messages
      if (event.type === "text_message" && event.text) {
        const text = event.text;
        console.log("[WORKFLOW] Received text_message:", text.substring(0, 50));

        // Check for /done command with instruction
        if (text.startsWith("/done")) {
          console.log("[WORKFLOW] Processing /done command");
          const instruction = text.replace("/done", "").trim();
          currentInstruction = instruction; // Store for later use in date extraction

          if (messageQueue.length === 0 && !instruction) {
            await sendMessage({
              chatId,
              text: "📭 No messages queued. Forward some messages first!",
            });
            continue;
          }

          if (!instruction) {
            state = "awaiting_instruction";
            await sendMessage({
              chatId,
              text: "What would you like to do with these messages?\n\nExamples:\n• create a contact\n• add to TechCorp\n• create a $50k deal",
            });
            continue;
          }

          // Process with AI
          state = "processing_ai";

          try {
            // Show thinking reaction immediately
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, "🤔");
            }

            // Lazy load schema (cached for 5 minutes)
            if (!schema) {
              if (event.messageId) {
                await setMessageReaction(chatId, event.messageId, "🔍");
              }
              schema = await fetchFullSchemaCached();
            }

            // Update reaction for AI processing
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, "🧠");
            }

            currentAction = await analyzeIntent({
              messages: messageQueue.map((m) => ({
                text: m.text,
                chatName: m.chatName,
                date: m.date,
                senderUsername: m.senderUsername,
                senderFirstName: m.senderFirstName,
                senderLastName: m.senderLastName,
              })),
              instruction,
              schema,
            });

            // Clear reaction
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }

            state = "awaiting_confirmation";
            const suggestionText = formatSuggestedAction(currentAction);
            const hasClarifications = currentAction.clarificationsNeeded.length > 0;

            // Send the result
            lastBotMessageId = await sendMessage({
              chatId,
              text: suggestionText,
              replyMarkup: {
                inline_keyboard: buildAISuggestionKeyboard(hasClarifications, currentAction.intent),
              },
            });

            logger.info("AI suggestion generated", {
              userId,
              intent: currentAction.intent,
              confidence: currentAction.confidence,
            });
          } catch (error) {
            // Clear reaction on error
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }
            
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error("AI analysis failed", { userId, error: errorMsg });

            await sendMessage({
              chatId,
              text: `❌ AI analysis failed: ${errorMsg.substring(0, 200)}`,
            });
            state = "idle";
          }
          continue;
        }

        // Handle instruction after /done without args
        if (state === "awaiting_instruction") {
          state = "processing_ai";

          try {
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, "🤔");
            }

            if (!schema) {
              if (event.messageId) {
                await setMessageReaction(chatId, event.messageId, "🔍");
              }
              schema = await fetchFullSchemaCached();
            }

            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, "🧠");
            }

            currentAction = await analyzeIntent({
              messages: messageQueue.map((m) => ({
                text: m.text,
                chatName: m.chatName,
                date: m.date,
                senderUsername: m.senderUsername,
                senderFirstName: m.senderFirstName,
                senderLastName: m.senderLastName,
              })),
              instruction: text,
              schema,
            });

            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }

            state = "awaiting_confirmation";
            const suggestionText = formatSuggestedAction(currentAction);
            const hasClarifications = currentAction.clarificationsNeeded.length > 0;

            lastBotMessageId = await sendMessage({
              chatId,
              text: suggestionText,
              replyMarkup: {
                inline_keyboard: buildAISuggestionKeyboard(hasClarifications, currentAction.intent),
              },
            });
          } catch (error) {
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }
            
            const errorMsg = error instanceof Error ? error.message : String(error);
            await sendMessage({
              chatId,
              text: `❌ AI analysis failed: ${errorMsg.substring(0, 200)}`,
            });
            state = "idle";
          }
          continue;
        }

        // Handle clarification text response - use AI to interpret
        if (state === "awaiting_clarification" && currentAction && schema) {
          const clarification = currentAction.clarificationsNeeded[currentClarificationIndex];

          try {
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, "🧠");
            }

            currentAction = await processClarification(
              currentAction,
              clarification.field,
              text,
              schema
            );

            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }

            state = "awaiting_confirmation";
            const suggestionText = formatSuggestedAction(currentAction);
            const hasClarifications = currentAction.clarificationsNeeded.length > 0;

            lastBotMessageId = await sendMessage({
              chatId,
              text: suggestionText,
              replyMarkup: {
                inline_keyboard: buildAISuggestionKeyboard(hasClarifications, currentAction.intent),
              },
            });
          } catch (error) {
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }
            const errorMsg = error instanceof Error ? error.message : String(error);
            await sendMessage({
              chatId,
              text: `❌ Failed to process: ${errorMsg.substring(0, 200)}`,
            });
          }
          continue;
        }

        // Handle edit value response - use AI to interpret
        if (state === "awaiting_edit_value" && currentAction && editingField && schema) {
          const fieldToEdit = editingField;
          editingField = null;

          try {
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, "🧠");
            }

            currentAction = await processClarification(
              currentAction,
              fieldToEdit,
              text,
              schema
            );

            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }

            state = "awaiting_confirmation";
            const suggestionText = formatSuggestedAction(currentAction);
            const hasClarifications = currentAction.clarificationsNeeded.length > 0;

            lastBotMessageId = await sendMessage({
              chatId,
              text: suggestionText,
              replyMarkup: {
                inline_keyboard: buildAISuggestionKeyboard(hasClarifications, currentAction.intent),
              },
            });
          } catch (error) {
            if (event.messageId) {
              await setMessageReaction(chatId, event.messageId, null);
            }
            const errorMsg = error instanceof Error ? error.message : String(error);
            await sendMessage({
              chatId,
              text: `❌ Failed to process: ${errorMsg.substring(0, 200)}`,
            });
            state = "awaiting_confirmation";
          }
          continue;
        }

        continue;
      }
    } catch (error) {
      logger.error("Error processing event", {
        userId,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
