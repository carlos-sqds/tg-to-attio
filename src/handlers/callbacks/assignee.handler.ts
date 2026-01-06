import type { Context } from "grammy";
import { getSession, updateSession } from "@/src/lib/kv/session.kv";
import {
  buildAssigneeKeyboard,
  buildConfirmationKeyboard,
  formatSuggestedAction,
} from "@/src/lib/telegram/keyboards";

/**
 * Handle assignee selection callback.
 * Sets the selected member as assignee.
 */
export async function handleAssigneeSelect(ctx: Context, memberId: string): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);
  if (!session || !session.currentAction || !session.schema) {
    await ctx.answerCallbackQuery("Session expired. Please start over.");
    return;
  }

  // Validate that the user clicking the button is the one who initiated the action
  if (session.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  await ctx.answerCallbackQuery();

  // Find the member
  const member = session.schema.workspaceMembers.find((m) => m.id === memberId);
  if (!member) {
    await ctx.answerCallbackQuery("Member not found");
    return;
  }

  // Update action with assignee
  const updatedAction = {
    ...session.currentAction,
    extractedData: {
      ...session.currentAction.extractedData,
      assignee_id: member.id,
      assignee: `${member.firstName} ${member.lastName}`,
    },
  };

  const suggestionText = formatSuggestedAction(updatedAction);
  const keyboard = buildConfirmationKeyboard(false, updatedAction.intent);

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
 * Handle assignee pagination (prev/next).
 */
export async function handleAssigneePagination(
  ctx: Context,
  direction: "prev" | "next"
): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);
  if (!session?.state || session.state.type !== "awaiting_assignee" || !session.schema) {
    await ctx.answerCallbackQuery("Session expired. Please start over.");
    return;
  }

  // Validate that the user clicking the button is the one who initiated the action
  if (session.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  await ctx.answerCallbackQuery();

  const { page, members } = session.state;
  const newPage = direction === "prev" ? page - 1 : page + 1;

  const keyboard = buildAssigneeKeyboard(members, newPage);

  await ctx.editMessageText("👤 Select an assignee:", { reply_markup: keyboard });

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_assignee",
      page: newPage,
      members,
    },
  });
}

/**
 * Handle manual assignee input.
 */
export async function handleAssigneeManual(ctx: Context): Promise<void> {
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

  await ctx.editMessageText("✏️ Please type the assignee's name:");

  await updateSession(chatId, userId, {
    state: { type: "awaiting_assignee_input" },
  });
}

/**
 * Handle skip assignee.
 */
export async function handleAssigneeSkip(ctx: Context): Promise<void> {
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

  // Remove assignee from action
  const updatedAction = {
    ...session.currentAction,
    extractedData: {
      ...session.currentAction.extractedData,
      assignee_id: undefined,
      assignee: undefined,
    },
  };

  const suggestionText = formatSuggestedAction(updatedAction);
  const keyboard = buildConfirmationKeyboard(false, updatedAction.intent);

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
 * Show assignee selection keyboard.
 * Called when user clicks "Change assignee" button.
 */
export async function showAssigneeSelection(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const session = await getSession(chatId, userId);
  if (!session || !session.schema) {
    await ctx.answerCallbackQuery("Session expired. Please start over.");
    return;
  }

  // Validate that the user clicking the button is the one who initiated the action
  if (session.initiatingUserId && session.initiatingUserId !== userId) {
    await ctx.answerCallbackQuery("This action belongs to another user");
    return;
  }

  await ctx.answerCallbackQuery();

  const members = session.schema.workspaceMembers;
  const keyboard = buildAssigneeKeyboard(members, 0);

  await ctx.editMessageText("👤 Select an assignee:", { reply_markup: keyboard });

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_assignee",
      page: 0,
      members,
    },
  });
}
