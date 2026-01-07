import type { Context } from "grammy";
import { getSession, updateSession } from "@/src/lib/kv/session.kv";
import {
  buildNoteParentTypeKeyboard,
  buildConfirmationKeyboard,
  formatSuggestedAction,
} from "@/src/lib/telegram/keyboards";

/**
 * Show note parent type selection.
 * Called when creating a note without a specified target.
 */
export async function showNoteParentTypeSelection(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);

  // Validate that the user clicking the button is the one who initiated the action
  if (session?.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  await ctx.answerCallbackQuery();

  const keyboard = buildNoteParentTypeKeyboard();

  await ctx.editMessageText("📝 Add note to which type of record?", {
    reply_markup: keyboard,
  });

  await updateSession(chatId, userId, {
    state: { type: "awaiting_note_parent_type" },
  });
}

/**
 * Handle note parent type selection.
 */
export async function handleNoteParentType(
  ctx: Context,
  parentType: "companies" | "people" | "deals"
): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);

  // Validate that the user clicking the button is the one who initiated the action
  if (session?.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  await ctx.answerCallbackQuery();

  const typeLabels: Record<string, string> = {
    companies: "company",
    people: "person",
    deals: "deal",
  };

  await ctx.editMessageText(`🔍 Search for a ${typeLabels[parentType]}:`);

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_note_parent_search",
      parentType,
    },
  });
}

/**
 * Handle note parent selection from search results.
 */
export async function handleNoteParentSelect(ctx: Context, recordId: string): Promise<void> {
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

  // Get the parent type from state
  let parentType: "companies" | "people" | "deals" = "companies";
  if (
    session.state.type === "awaiting_note_parent_selection" ||
    session.state.type === "awaiting_note_parent_search"
  ) {
    parentType = "parentType" in session.state ? session.state.parentType : "companies";
  }

  // Update action with note target
  const updatedAction = {
    ...session.currentAction,
    extractedData: {
      ...session.currentAction.extractedData,
      parent_object: parentType,
      parent_record_id: recordId,
    },
  };

  const suggestionText = formatSuggestedAction(updatedAction);
  const keyboard = buildConfirmationKeyboard([], updatedAction.intent);

  await ctx.editMessageText(suggestionText, { reply_markup: keyboard });

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_confirmation",
      action: updatedAction,
    },
    currentAction: updatedAction,
  });
}

/**
 * Handle search again for note parent.
 */
export async function handleNoteParentSearchAgain(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);

  // Validate that the user clicking the button is the one who initiated the action
  if (session?.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  await ctx.answerCallbackQuery();

  // Just show the type selection again
  const keyboard = buildNoteParentTypeKeyboard();

  await ctx.editMessageText("📝 Add note to which type of record?", {
    reply_markup: keyboard,
  });

  await updateSession(chatId, userId, {
    state: { type: "awaiting_note_parent_type" },
  });
}
