import { logger } from "@/src/lib/logger";
import { BUILD_INFO } from "@/src/lib/build-info";
import type { ForwardedMessageData } from "@/src/types";
import type { SuggestedAction, AttioSchema } from "@/src/services/attio/schema-types";
import { telegramHook, type CallerInfo } from "./hooks";
import {
  sendMessage,
  editMessage,
  answerCallbackQuery,
  withCyclingReaction,
  buildAISuggestionKeyboard,
  buildClarificationKeyboard,
  buildEditFieldKeyboard,
  buildMemberSelectionKeyboard,
  formatSuggestedAction,
} from "./steps/telegram";
import { analyzeIntent, processClarification, resolveAssignee } from "./steps/ai";
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
  | "awaiting_assignee_selection"
  | "awaiting_assignee_input"
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
  let callerInfo: CallerInfo | null = null; // Store caller info for assignee resolution
  let assigneeSelectionPage = 0; // Pagination for assignee selection
  const sessionStartTime = new Date();

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
/session - Show version & session info
/help - Show this message`,
  });

  logger.info("AI Workflow started", { userId });

  const events = telegramHook.create({ token: `ai6-${userId}` });

  for await (const event of events) {
    try {
      logger.info("Processing event", { userId, eventType: event.type, state });

      // Handle terminate signal (from /start creating new session)
      if (event.type === "terminate") {
        logger.info("Workflow terminated by /start", { userId });
        break; // Exit gracefully, releases hook token
      }

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
                recordId: result.recordId,
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

        // Change assignee for task
        if (data === "change_assignee" && currentAction && schema) {
          const currentSchema = schema as AttioSchema;
          state = "awaiting_assignee_selection";
          assigneeSelectionPage = 0;

          await sendMessage({
            chatId,
            text: "Select an assignee:",
            replyMarkup: {
              inline_keyboard: buildMemberSelectionKeyboard(currentSchema.workspaceMembers, 0),
            },
          });
          continue;
        }

        // Assignee selected from list
        if (data.startsWith("assignee:") && currentAction && schema) {
          const currentSchema = schema as AttioSchema;
          const memberId = data.replace("assignee:", "");
          const member = currentSchema.workspaceMembers.find((m) => m.id === memberId);

          if (member) {
            currentAction.extractedData.assignee_id = memberId;
            currentAction.extractedData.assignee = `${member.firstName} ${member.lastName}`;
            currentAction.extractedData.assignee_email = member.email;

            state = "awaiting_confirmation";
            const suggestionText = formatSuggestedAction(currentAction);

            lastBotMessageId = await sendMessage({
              chatId,
              text: suggestionText,
              replyMarkup: {
                inline_keyboard: buildAISuggestionKeyboard(false, currentAction.intent),
              },
            });
          }
          continue;
        }

        // Assignee pagination
        if (data === "assignee_prev" && schema) {
          const currentSchema = schema as AttioSchema;
          assigneeSelectionPage = Math.max(0, assigneeSelectionPage - 1);
          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "Select an assignee:",
              replyMarkup: {
                inline_keyboard: buildMemberSelectionKeyboard(
                  currentSchema.workspaceMembers,
                  assigneeSelectionPage
                ),
              },
            });
          }
          continue;
        }

        if (data === "assignee_next" && schema) {
          const currentSchema = schema as AttioSchema;
          const totalPages = Math.ceil(currentSchema.workspaceMembers.length / 5);
          assigneeSelectionPage = Math.min(totalPages - 1, assigneeSelectionPage + 1);
          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "Select an assignee:",
              replyMarkup: {
                inline_keyboard: buildMemberSelectionKeyboard(
                  currentSchema.workspaceMembers,
                  assigneeSelectionPage
                ),
              },
            });
          }
          continue;
        }

        // Type assignee name manually
        if (data === "assignee_type") {
          state = "awaiting_assignee_input";
          await sendMessage({
            chatId,
            text: "Type the assignee name:",
          });
          continue;
        }

        // No-op for pagination display
        if (data === "noop") {
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
            text: count > 0 ? `🗑️ Cleared ${count} message(s).` : "✨ Queue is already empty.",
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
/cancel - Cancel current operation
/session - Show version info`,
            parseMode: "Markdown",
          });
          continue;
        }

        if (command === "/session") {
          const now = new Date();
          const sessionAge = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
          const sessionAgeStr =
            sessionAge < 60
              ? `${sessionAge}s`
              : sessionAge < 3600
                ? `${Math.floor(sessionAge / 60)}m ${sessionAge % 60}s`
                : `${Math.floor(sessionAge / 3600)}h ${Math.floor((sessionAge % 3600) / 60)}m`;

          const buildDate = new Date(BUILD_INFO.buildTime);
          const buildAge = Math.floor((now.getTime() - buildDate.getTime()) / 1000 / 60);
          const buildAgeStr =
            buildAge < 60
              ? `${buildAge}m ago`
              : buildAge < 1440
                ? `${Math.floor(buildAge / 60)}h ago`
                : `${Math.floor(buildAge / 1440)}d ago`;

          await sendMessage({
            chatId,
            text: `📊 **Session Info**

**Version:** \`${BUILD_INFO.commitHashShort}\`
**Built:** ${buildDate.toLocaleString()} (${buildAgeStr})

**Session started:** ${sessionStartTime.toLocaleString()}
**Session age:** ${sessionAgeStr}
**Messages queued:** ${messageQueue.length}
**State:** ${state}

Send /start to create a fresh session.`,
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

          // Store caller info for assignee resolution (from TelegramMessageEvent)
          if (event.callerInfo) {
            callerInfo = event.callerInfo;
          }

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
          console.log("[WORKFLOW] Starting AI processing", {
            hasMessageId: !!event.messageId,
            queueLength: messageQueue.length,
          });

          try {
            // Lazy load schema first (outside the callback)
            console.log("[WORKFLOW] Fetching schema...");
            if (!schema) {
              schema = await fetchFullSchemaCached();
            }
            console.log("[WORKFLOW] Schema loaded", {
              objectCount: schema.objects.length,
              memberCount: schema.workspaceMembers.length,
            });

            // Prepare messages for AI
            const messagesForAI = messageQueue.map((m) => ({
              text: m.text,
              chatName: m.chatName,
              date: m.date,
              senderUsername: m.senderUsername,
              senderFirstName: m.senderFirstName,
              senderLastName: m.senderLastName,
            }));

            console.log("[WORKFLOW] Calling analyzeIntent...");
            currentAction = await analyzeIntent({
              messages: messagesForAI,
              instruction,
              schema,
            });
            console.log("[WORKFLOW] analyzeIntent completed", { intent: currentAction.intent });

            // Auto-resolve assignee for tasks (handles "me", empty, or name)
            if (currentAction.intent === "create_task" && schema) {
              console.log("[WORKFLOW] Resolving assignee for task...");
              const currentSchema = schema as AttioSchema;
              const assigneeName = String(
                currentAction.extractedData.assignee ||
                  currentAction.extractedData.assignee_email ||
                  ""
              );
              const resolved = await resolveAssignee(
                assigneeName,
                callerInfo,
                currentSchema.workspaceMembers,
                true
              );
              console.log("[WORKFLOW] Assignee resolved", { assigneeName, resolved: !!resolved });
              if (resolved) {
                currentAction.extractedData.assignee_id = resolved.memberId;
                currentAction.extractedData.assignee = resolved.memberName;
                currentAction.extractedData.assignee_email = resolved.email;
              }
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
            // Reaction is auto-cleared by withCyclingReaction
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
            const processWithAI = async () => {
              if (!schema) {
                schema = await fetchFullSchemaCached();
              }

              return await analyzeIntent({
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
            };

            if (event.messageId) {
              currentAction = await withCyclingReaction(chatId, event.messageId, processWithAI);
            } else {
              currentAction = await processWithAI();
            }

            // Auto-resolve assignee for tasks (handles "me", empty, or name)
            if (currentAction.intent === "create_task" && schema) {
              const currentSchema = schema as AttioSchema;
              const assigneeName = String(
                currentAction.extractedData.assignee ||
                  currentAction.extractedData.assignee_email ||
                  ""
              );
              const resolved = await resolveAssignee(
                assigneeName,
                callerInfo,
                currentSchema.workspaceMembers,
                true
              );
              if (resolved) {
                currentAction.extractedData.assignee_id = resolved.memberId;
                currentAction.extractedData.assignee = resolved.memberName;
                currentAction.extractedData.assignee_email = resolved.email;
              }
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
            const processWithAI = async () => {
              return await processClarification(currentAction!, clarification.field, text, schema!);
            };

            if (event.messageId) {
              currentAction = await withCyclingReaction(chatId, event.messageId, processWithAI);
            } else {
              currentAction = await processWithAI();
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
            const processWithAI = async () => {
              return await processClarification(currentAction!, fieldToEdit, text, schema!);
            };

            if (event.messageId) {
              currentAction = await withCyclingReaction(chatId, event.messageId, processWithAI);
            } else {
              currentAction = await processWithAI();
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
            const errorMsg = error instanceof Error ? error.message : String(error);
            await sendMessage({
              chatId,
              text: `❌ Failed to process: ${errorMsg.substring(0, 200)}`,
            });
            state = "awaiting_confirmation";
          }
          continue;
        }

        // Handle assignee name input - use LLM to resolve
        if (state === "awaiting_assignee_input" && currentAction && schema) {
          const currentSchema = schema as AttioSchema;
          try {
            const resolved = await resolveAssignee(
              text,
              callerInfo,
              currentSchema.workspaceMembers,
              false
            );

            if (resolved) {
              currentAction.extractedData.assignee_id = resolved.memberId;
              currentAction.extractedData.assignee = resolved.memberName;
              currentAction.extractedData.assignee_email = resolved.email;

              state = "awaiting_confirmation";
              const suggestionText = formatSuggestedAction(currentAction);

              lastBotMessageId = await sendMessage({
                chatId,
                text: suggestionText,
                replyMarkup: {
                  inline_keyboard: buildAISuggestionKeyboard(false, currentAction.intent),
                },
              });
            } else {
              await sendMessage({
                chatId,
                text: `❌ Could not find a matching team member for "${text}". Please try again or select from the list.`,
                replyMarkup: {
                  inline_keyboard: buildMemberSelectionKeyboard(currentSchema.workspaceMembers, 0),
                },
              });
              state = "awaiting_assignee_selection";
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await sendMessage({
              chatId,
              text: `❌ Failed to resolve assignee: ${errorMsg.substring(0, 200)}`,
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
