/**
 * Callback action identifiers for inline keyboards.
 * Prefixed with "attio:" to avoid collision with other bots.
 */
export const CallbackAction = {
  // Main actions
  CONFIRM: "attio:confirm",
  EDIT: "attio:edit",
  CANCEL: "attio:cancel",

  // Clarification flow
  CLARIFY: "attio:clarify",
  CLARIFY_OPTION: "attio:clarify:opt", // + option index

  // Field editing
  EDIT_FIELD: "attio:edit:field", // + field name

  // Assignee selection
  ASSIGNEE_SELECT: "attio:assignee:select", // + member id
  ASSIGNEE_PREV: "attio:assignee:prev",
  ASSIGNEE_NEXT: "attio:assignee:next",
  ASSIGNEE_MANUAL: "attio:assignee:manual",
  ASSIGNEE_SKIP: "attio:assignee:skip",

  // Note parent selection
  NOTE_PARENT_TYPE: "attio:note:type", // + object type
  NOTE_PARENT_SELECT: "attio:note:select", // + record id
  NOTE_PARENT_SEARCH: "attio:note:search",

  // Skip/back navigation
  SKIP: "attio:skip",
  BACK: "attio:back",
} as const;

export type CallbackAction = (typeof CallbackAction)[keyof typeof CallbackAction];

/**
 * Parsed callback data with action and optional payload.
 */
export interface CallbackData {
  action: string;
  payload?: string;
}

/**
 * Parse callback data string into action and optional payload.
 * Format: "action" or "action:payload"
 *
 * @example
 * parseCallbackData("attio:confirm") // { action: "attio:confirm" }
 * parseCallbackData("attio:clarify:opt:0") // { action: "attio:clarify:opt", payload: "0" }
 * parseCallbackData("attio:edit:field:email") // { action: "attio:edit:field", payload: "email" }
 */
export function parseCallbackData(data: string): CallbackData {
  // Handle special patterns with multiple colons
  const patterns = [
    "attio:clarify:opt:",
    "attio:edit:field:",
    "attio:assignee:select:",
    "attio:note:type:",
    "attio:note:select:",
  ];

  for (const pattern of patterns) {
    if (data.startsWith(pattern)) {
      return {
        action: pattern.slice(0, -1), // Remove trailing colon
        payload: data.slice(pattern.length),
      };
    }
  }

  // Simple action without payload
  return { action: data };
}

/**
 * Build callback data string from action and optional payload.
 *
 * @example
 * buildCallbackData(CallbackAction.CONFIRM) // "attio:confirm"
 * buildCallbackData(CallbackAction.CLARIFY_OPTION, "0") // "attio:clarify:opt:0"
 */
export function buildCallbackData(action: string, payload?: string): string {
  if (payload !== undefined) {
    return `${action}:${payload}`;
  }
  return action;
}

/**
 * Check if callback data matches a specific action.
 */
export function isCallbackAction(data: string, action: CallbackAction): boolean {
  return data === action || data.startsWith(`${action}:`);
}
