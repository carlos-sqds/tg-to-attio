import { Bot, webhookCallback } from "grammy";
import { config } from "@/src/lib/config";
import { CallbackAction, parseCallbackData } from "@/src/lib/types/callback.types";

// Command handlers
import { handleStart } from "@/src/handlers/commands/start.handler";
import { handleDone } from "@/src/handlers/commands/done.handler";
import { handleNew } from "@/src/handlers/commands/new.handler";
import { handleClear } from "@/src/handlers/commands/clear.handler";
import { handleCancel } from "@/src/handlers/commands/cancel.handler";
import { handleHelp } from "@/src/handlers/commands/help.handler";

// Message handlers
import { handleForward } from "@/src/handlers/messages/forward.handler";
import { handleText } from "@/src/handlers/messages/text.handler";

// Callback handlers
import {
  handleConfirm,
  handleCancel as handleCancelCallback,
  handleSkip,
} from "@/src/handlers/callbacks/confirm.handler";
import { handleClarify, handleClarifyOption } from "@/src/handlers/callbacks/clarify.handler";
import { handleEdit, handleEditField } from "@/src/handlers/callbacks/edit.handler";
import {
  handleAssigneeSelect,
  handleAssigneePagination,
  handleAssigneeManual,
  handleAssigneeSkip,
  showAssigneeSelection,
} from "@/src/handlers/callbacks/assignee.handler";
import {
  handleNoteParentType,
  handleNoteParentSelect,
  handleNoteParentSearchAgain,
} from "@/src/handlers/callbacks/note-parent.handler";

/**
 * Singleton bot instance.
 * Reused across requests for efficiency.
 */
let bot: Bot | null = null;

/**
 * Initialize the grammY bot with all handlers.
 * Handlers are registered on first call, then cached.
 */
export function initBot(): Bot {
  if (bot) {
    return bot;
  }

  bot = new Bot(config.botToken);

  // Register command handlers
  bot.command("start", handleStart);
  bot.command("done", handleDone);
  bot.command("new", handleNew);
  bot.command("clear", handleClear);
  bot.command("cancel", handleCancel);
  bot.command("help", handleHelp);

  // Register callback query handler (routes to specific handlers)
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const parsed = parseCallbackData(data);

    switch (parsed.action) {
      case CallbackAction.CONFIRM:
        await handleConfirm(ctx);
        break;

      case CallbackAction.CANCEL:
        await handleCancelCallback(ctx);
        break;

      case CallbackAction.SKIP:
        await handleSkip(ctx);
        break;

      case CallbackAction.EDIT:
        await handleEdit(ctx);
        break;

      case CallbackAction.EDIT_FIELD:
        if (parsed.payload === "assignee") {
          await showAssigneeSelection(ctx);
        } else if (parsed.payload) {
          await handleEditField(ctx, parsed.payload);
        }
        break;

      case CallbackAction.CLARIFY:
        await handleClarify(ctx);
        break;

      case CallbackAction.CLARIFY_OPTION:
        if (parsed.payload) {
          await handleClarifyOption(ctx, parsed.payload);
        }
        break;

      case CallbackAction.ASSIGNEE_SELECT:
        if (parsed.payload) {
          await handleAssigneeSelect(ctx, parsed.payload);
        }
        break;

      case CallbackAction.ASSIGNEE_PREV:
        await handleAssigneePagination(ctx, "prev");
        break;

      case CallbackAction.ASSIGNEE_NEXT:
        await handleAssigneePagination(ctx, "next");
        break;

      case CallbackAction.ASSIGNEE_MANUAL:
        await handleAssigneeManual(ctx);
        break;

      case CallbackAction.ASSIGNEE_SKIP:
        await handleAssigneeSkip(ctx);
        break;

      case CallbackAction.NOTE_PARENT_TYPE:
        if (parsed.payload) {
          await handleNoteParentType(ctx, parsed.payload as "companies" | "people" | "deals");
        }
        break;

      case CallbackAction.NOTE_PARENT_SELECT:
        if (parsed.payload) {
          await handleNoteParentSelect(ctx, parsed.payload);
        }
        break;

      case CallbackAction.NOTE_PARENT_SEARCH:
        await handleNoteParentSearchAgain(ctx);
        break;

      default:
        // Handle legacy callback data patterns
        if (data === "ai_confirm") {
          await handleConfirm(ctx);
        } else if (data === "ai_clarify") {
          await handleClarify(ctx);
        } else if (data === "ai_edit") {
          await handleEdit(ctx);
        } else if (data === "change_assignee") {
          await showAssigneeSelection(ctx);
        } else if (data.startsWith("assignee:")) {
          await handleAssigneeSelect(ctx, data.replace("assignee:", ""));
        } else if (data === "assignee_prev") {
          await handleAssigneePagination(ctx, "prev");
        } else if (data === "assignee_next") {
          await handleAssigneePagination(ctx, "next");
        } else if (data === "assignee_type") {
          await handleAssigneeManual(ctx);
        } else if (data.startsWith("clarify_option:")) {
          await handleClarifyOption(ctx, data.replace("clarify_option:", ""));
        } else if (data === "clarify_type") {
          await handleClarifyOption(ctx, "__type__");
        } else if (data === "clarify_skip") {
          await handleSkip(ctx);
        } else if (data.startsWith("edit_field:")) {
          await handleEditField(ctx, data.replace("edit_field:", ""));
        } else if (data.startsWith("note_parent_type:")) {
          await handleNoteParentType(
            ctx,
            data.replace("note_parent_type:", "") as "companies" | "people" | "deals"
          );
        } else if (data.startsWith("note_parent_select:")) {
          await handleNoteParentSelect(ctx, data.replace("note_parent_select:", ""));
        } else if (data === "note_parent_search_again") {
          await handleNoteParentSearchAgain(ctx);
        } else {
          console.log("[Bot] Unknown callback:", data);
          await ctx.answerCallbackQuery("Unknown action");
        }
    }
  });

  // Register message handlers
  // Check for forwarded messages first
  bot.on("message:forward_origin", handleForward);

  // Then handle regular text messages (not commands)
  bot.on("message:text", async (ctx) => {
    // Skip if it's a command (already handled)
    if (ctx.message.text.startsWith("/")) {
      return;
    }
    await handleText(ctx);
  });

  // Error handler
  bot.catch((err) => {
    console.error("[Bot Error]", err);
  });

  return bot;
}

/**
 * Get the webhook callback handler for Next.js.
 * Use in API route: return webhookHandler(req)
 */
export function getWebhookHandler(): (req: Request) => Promise<Response> {
  const botInstance = initBot();
  return webhookCallback(botInstance, "std/http");
}

/**
 * Reset bot instance (for testing).
 */
export function resetBot(): void {
  bot = null;
}
