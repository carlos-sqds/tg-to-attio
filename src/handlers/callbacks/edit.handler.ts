import type { Context } from "grammy";
import { getSession, updateSession } from "@/src/lib/kv/session.kv";
import { buildEditFieldKeyboard } from "@/src/lib/telegram/keyboards";

/**
 * Handle edit callback.
 * Shows editable fields for the user to modify.
 */
export async function handleEdit(ctx: Context): Promise<void> {
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

  // Get editable fields from extracted data
  const editableFields = Object.keys(session.currentAction.extractedData).filter(
    (key) => !["noteTitle", "linked_record_id", "linked_record_object", "assignee_id"].includes(key)
  );

  if (editableFields.length === 0) {
    await ctx.answerCallbackQuery("No editable fields");
    return;
  }

  const keyboard = buildEditFieldKeyboard(editableFields);

  await ctx.editMessageText("✏️ Which field would you like to edit?", {
    reply_markup: keyboard,
  });
}

/**
 * Handle edit field callback.
 * Allows user to edit a specific field value.
 */
export async function handleEditField(ctx: Context, field: string): Promise<void> {
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

  const currentValue = session.currentAction.extractedData[field];
  const displayValue =
    typeof currentValue === "object" ? JSON.stringify(currentValue) : String(currentValue || "");

  await ctx.editMessageText(
    `✏️ Editing: ${field}\n\n` +
      `Current value: ${displayValue || "(empty)"}\n\n` +
      `Please type the new value:`
  );

  await updateSession(chatId, userId, {
    state: {
      type: "awaiting_edit",
      field,
      originalValue: currentValue,
    },
  });
}
