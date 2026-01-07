/**
 * Assignee selection keyboard with pagination.
 */

import { InlineKeyboard } from "grammy";
import type { WorkspaceMember } from "@/src/services/attio/schema-types";
import { CallbackAction, buildCallbackData } from "@/src/lib/types/callback.types";

/**
 * Build keyboard for member/assignee selection.
 * Supports pagination for large member lists.
 */
export function buildAssigneeKeyboard(
  members: WorkspaceMember[],
  page: number = 0,
  pageSize: number = 5
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const totalPages = Math.ceil(members.length / pageSize);
  const startIdx = page * pageSize;
  const endIdx = Math.min(startIdx + pageSize, members.length);
  const pageMembers = members.slice(startIdx, endIdx);

  for (const member of pageMembers) {
    const label = `👤 ${member.firstName} ${member.lastName}`;
    keyboard.text(label, buildCallbackData(CallbackAction.ASSIGNEE_SELECT, member.id)).row();
  }

  // Add pagination if needed
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text("◀️ Prev", CallbackAction.ASSIGNEE_PREV);
    }
    keyboard.text(`${page + 1}/${totalPages}`, "noop");
    if (page < totalPages - 1) {
      keyboard.text("Next ▶️", CallbackAction.ASSIGNEE_NEXT);
    }
    keyboard.row();
  }

  keyboard
    .text("✏️ Type name", CallbackAction.ASSIGNEE_MANUAL)
    .row()
    .text("⏭️ Skip", CallbackAction.ASSIGNEE_SKIP)
    .text("❌ Cancel", CallbackAction.CANCEL);

  return keyboard;
}
