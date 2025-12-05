import { logger } from "@/src/lib/logger";
import type { ForwardedMessageData, RecentCompany, CompanySearchResult } from "@/src/types";
import { telegramHook, type TelegramEvent } from "./hooks";
import {
  sendMessage,
  editMessage,
  answerCallbackQuery,
  buildCompanySelectionKeyboard,
  buildSearchResultsKeyboard,
  buildConfirmationKeyboard,
} from "./steps/telegram";
import { searchCompanies, createNote } from "./steps/attio";
import { formatMessagesForSingleNote } from "@/src/services/attio/formatters";

type ConversationState =
  | "idle"
  | "awaiting_company_search"
  | "awaiting_company_selection"
  | "awaiting_confirmation";

export async function conversationWorkflow(userId: number, chatId: number) {
  "use workflow";

  let messageQueue: ForwardedMessageData[] = [];
  let recentCompanies: RecentCompany[] = [];
  let searchResults: CompanySearchResult[] = [];
  let selectedCompany: { id: string; name: string } | null = null;
  let lastBotMessageId: number | null = null;
  let state: ConversationState = "idle";

  // Send welcome message immediately when workflow starts
  await sendMessage({
    chatId,
    text: `👋 Welcome to the Attio CRM Bot!

📋 How it works:

1️⃣ Forward me messages from your customer conversations
2️⃣ When you're done forwarding, send /done
3️⃣ Select which company they belong to
4️⃣ All messages will be added to that company in Attio

Commands:
/done - Process queued messages
/clear - Clear message queue
/cancel - Cancel current operation
/help - Show this help message`,
  });

  logger.info("Workflow started, waiting for events", { userId });

  // Create hook and wait for events
  const events = telegramHook.create({ token: `user-${userId}` });

  for await (const event of events) {
    try {
      logger.info("Processing event", { userId, eventType: event.type, state });

      if (event.type === "callback_query") {
        await answerCallbackQuery(event.callbackQueryId);
        const data = event.callbackData;

        if (data === "cancel") {
          messageQueue = [];
          selectedCompany = null;
          searchResults = [];
          state = "idle";

          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "❌ Operation cancelled. Message queue cleared.",
            });
          }
          continue;
        }

        if (data === "search") {
          state = "awaiting_company_search";
          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "🔍 Type the company name to search:",
            });
          }
          continue;
        }

        if (data === "back") {
          selectedCompany = null;
          state = "awaiting_company_selection";

          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "Which company are these messages for?",
              replyMarkup: {
                inline_keyboard: buildCompanySelectionKeyboard(recentCompanies),
              },
            });
          }
          continue;
        }

        if (data.startsWith("select:")) {
          const companyId = data.replace("select:", "");
          const allCompanies = [
            ...recentCompanies.map((c) => ({ id: c.id, name: c.name })),
            ...searchResults,
          ];
          const company = allCompanies.find((c) => c.id === companyId);

          if (!company) {
            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: "❌ Company not found. Please try again.",
              });
            }
            continue;
          }

          selectedCompany = { id: company.id, name: company.name };
          state = "awaiting_confirmation";

          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: `Add ${messageQueue.length} message(s) to **${company.name}**?\n\nThis will create a note in Attio.`,
              parseMode: "Markdown",
              replyMarkup: { inline_keyboard: buildConfirmationKeyboard() },
            });
          }
          continue;
        }

        if (data === "confirm" && selectedCompany) {
          if (lastBotMessageId) {
            await editMessage({
              chatId,
              messageId: lastBotMessageId,
              text: "💾 Saving messages...",
            });
          }

          try {
            const formatted = formatMessagesForSingleNote(messageQueue);

            await createNote({
              parent_object: "companies",
              parent_record_id: selectedCompany.id,
              title: formatted.title,
              format: "markdown",
              content: formatted.content,
            });

            recentCompanies = [
              { id: selectedCompany.id, name: selectedCompany.name, usedAt: Date.now() },
              ...recentCompanies.filter((c) => c.id !== selectedCompany!.id),
            ].slice(0, 5);

            const savedCount = messageQueue.length;
            const companyName = selectedCompany.name;

            messageQueue = [];
            selectedCompany = null;
            searchResults = [];
            state = "idle";

            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: `✅ Successfully added ${savedCount} message(s) to **${companyName}**!`,
                parseMode: "Markdown",
              });
            }

            logger.info("Messages saved", { userId, companyName, messageCount: savedCount });
          } catch (error) {
            logger.error("Failed to save messages", { error });
            if (lastBotMessageId) {
              await editMessage({
                chatId,
                messageId: lastBotMessageId,
                text: "❌ Failed to save messages. Please try again.",
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
          selectedCompany = null;
          searchResults = [];
          state = "idle";

          await sendMessage({
            chatId,
            text: count > 0 ? `🗑️ Cleared ${count} message(s) from queue.` : "✨ Queue is already empty.",
          });
          continue;
        }

        if (command === "/cancel") {
          messageQueue = [];
          selectedCompany = null;
          searchResults = [];
          state = "idle";

          await sendMessage({
            chatId,
            text: "❌ Operation cancelled. All data cleared.",
          });
          continue;
        }

        if (command === "/done") {
          if (messageQueue.length === 0) {
            await sendMessage({
              chatId,
              text: "📭 No messages in queue. Forward some messages first!",
            });
            continue;
          }

          const queueCount = messageQueue.length;
          const firstMessage = messageQueue[0];
          const lastMessage = messageQueue[queueCount - 1];

          const formatDate = (ts: number) =>
            new Date(ts * 1000).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

          const escapeMarkdown = (text: string) =>
            text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
          const firstPreview =
            escapeMarkdown(firstMessage.text.substring(0, 100)) +
            (firstMessage.text.length > 100 ? "..." : "");

          const preview = `📊 *Total:* ${queueCount} message(s)
📤 *From:* ${escapeMarkdown(firstMessage.chatName)}
📅 *First:* ${formatDate(firstMessage.date)}
📅 *Last:* ${formatDate(lastMessage.date)}

*First message:* ${firstPreview}

Which company are these messages for?`;

          state = "awaiting_company_selection";

          lastBotMessageId = await sendMessage({
            chatId,
            text: preview,
            parseMode: "Markdown",
            replyMarkup: {
              inline_keyboard: buildCompanySelectionKeyboard(recentCompanies),
            },
          });
          continue;
        }

        continue;
      }

      // Handle forwarded messages
      if (event.type === "forwarded_message" && event.forwardedMessage) {
        messageQueue.push(event.forwardedMessage);

        await sendMessage({
          chatId,
          text: `📥 Message queued (${messageQueue.length})\n\nSend more messages or use /done to process them.`,
        });
        continue;
      }

      // Handle text messages (company search)
      if (event.type === "text_message" && state === "awaiting_company_search") {
        const query = event.text || "";

        await sendMessage({ chatId, text: "🔍 Searching..." });

        try {
          searchResults = await searchCompanies(query);

          if (searchResults.length === 0) {
            await sendMessage({
              chatId,
              text: `No companies found for "${query}". Try different terms.`,
              replyMarkup: {
                inline_keyboard: [
                  [
                    { text: "🔍 Search again", callback_data: "search" },
                    { text: "❌ Cancel", callback_data: "cancel" },
                  ],
                ],
              },
            });
            continue;
          }

          state = "awaiting_company_selection";

          lastBotMessageId = await sendMessage({
            chatId,
            text: "Select a company:",
            replyMarkup: { inline_keyboard: buildSearchResultsKeyboard(searchResults) },
          });
        } catch (error) {
          logger.error("Search failed", { error });
          await sendMessage({
            chatId,
            text: "❌ Search failed. Please try again.",
          });
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
