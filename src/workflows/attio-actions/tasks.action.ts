/**
 * Task operations for Attio CRM.
 * Includes deadline parsing utilities.
 */

import { attioRequest, getApiKey, type ActionResult, type AttioTaskResponse } from "./api";

export interface CreateTaskInput {
  content: string;
  assigneeId?: string;
  assigneeEmail?: string;
  deadline?: unknown;
  linkedRecordId?: string;
  linkedRecordObject?: string;
}

/**
 * Parse company input that may include domain.
 * Supports formats: "Name from domain.com", "Name (domain.com)", "domain.com"
 */
export function parseCompanyInput(input: string): { name: string; domain?: string } {
  const trimmed = input.trim();

  const fromPattern = trimmed.match(/^(.+?)\s+from\s+(\S+\.\S+)$/i);
  if (fromPattern) {
    return { name: fromPattern[1].trim(), domain: fromPattern[2].toLowerCase() };
  }

  const parenPattern = trimmed.match(/^(.+?)\s*\((\S+\.\S+)\)$/);
  if (parenPattern) {
    return { name: parenPattern[1].trim(), domain: parenPattern[2].toLowerCase() };
  }

  const domainOnly = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z.]+)$/i);
  if (domainOnly) {
    const domain = domainOnly[1].toLowerCase();
    const namePart = domain.split(".")[0];
    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    return { name, domain };
  }

  return { name: trimmed };
}

/**
 * Convert a Date to Attio's expected date format with microseconds.
 */
export function toAttioDateFormat(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/\.(\d{3})Z$/, ".$1000000Z");
}

/**
 * Parse deadline string into Attio date format.
 * Supports: "tomorrow", "next week", "in X days", day names, ISO dates, etc.
 */
export function parseDeadline(deadline: unknown): string | null {
  if (!deadline) return null;

  const deadlineStr = typeof deadline === "string" ? deadline : String(deadline);
  if (!deadlineStr || deadlineStr === "undefined" || deadlineStr === "null") return null;

  const now = new Date();
  const lowerDeadline = deadlineStr.toLowerCase().trim();

  if (lowerDeadline.includes("tomorrow")) {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  if (
    lowerDeadline.includes("next week") ||
    lowerDeadline === "1 week" ||
    lowerDeadline === "a week"
  ) {
    now.setDate(now.getDate() + 7);
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  const dayMatch = lowerDeadline.match(
    /(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
  );
  if (dayMatch) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDay = days.indexOf(dayMatch[1].toLowerCase());
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    now.setDate(now.getDate() + daysUntil);
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  const daysMatch = lowerDeadline.match(/(?:in\s+)?(\d+)\s*days?/i);
  if (daysMatch) {
    now.setDate(now.getDate() + parseInt(daysMatch[1], 10));
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  const wordToNum: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const weeksMatch = lowerDeadline.match(/(?:in\s+)?(\d+|one|two|three|four|five|six)\s*weeks?/i);
  if (weeksMatch) {
    const weekValue = weeksMatch[1].toLowerCase();
    const weeks = wordToNum[weekValue] || parseInt(weekValue, 10);
    if (!isNaN(weeks)) {
      now.setDate(now.getDate() + weeks * 7);
      now.setHours(9, 0, 0, 0);
      return toAttioDateFormat(now);
    }
  }

  if (lowerDeadline.includes("end of week") || lowerDeadline === "eow") {
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilFriday);
    now.setHours(17, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  const isoMatch = deadlineStr.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const isoDate = new Date(deadlineStr);
    if (!isNaN(isoDate.getTime())) {
      return toAttioDateFormat(isoDate);
    }
  }

  return null;
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult> {
  const apiKey = getApiKey();

  const linkedRecords: Array<{ target_object: string; target_record_id: string }> = [];
  if (input.linkedRecordId && input.linkedRecordObject) {
    linkedRecords.push({
      target_object: input.linkedRecordObject,
      target_record_id: input.linkedRecordId,
    });
  }

  const assignees: Array<{ referenced_actor_type: string; referenced_actor_id: string }> = [];
  if (input.assigneeId) {
    assignees.push({
      referenced_actor_type: "workspace-member",
      referenced_actor_id: input.assigneeId,
    });
  }

  const parsedDeadline = parseDeadline(input.deadline);

  const data: Record<string, unknown> = {
    content: input.content,
    format: "plaintext",
    is_completed: false,
    deadline_at: parsedDeadline,
    linked_records: linkedRecords,
    assignees: assignees,
  };

  try {
    const response = await attioRequest<AttioTaskResponse>("/tasks", apiKey, {
      method: "POST",
      body: JSON.stringify({ data }),
    });

    return {
      success: true,
      recordId: response.data.id.task_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
