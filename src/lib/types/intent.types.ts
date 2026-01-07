/**
 * Attio action intent identifiers.
 * Used across action execution, keyboards, and AI intent detection.
 */
export const AttioIntent = {
  CREATE_PERSON: "create_person",
  CREATE_COMPANY: "create_company",
  CREATE_DEAL: "create_deal",
  CREATE_TASK: "create_task",
  ADD_NOTE: "add_note",
  ADD_TO_LIST: "add_to_list",
} as const;

export type AttioIntent = (typeof AttioIntent)[keyof typeof AttioIntent];

/**
 * Intents that can link to a company record.
 * Used to show "Change company" button in confirmation keyboard.
 */
export const COMPANY_LINKED_INTENTS: AttioIntent[] = [
  AttioIntent.CREATE_TASK,
  AttioIntent.CREATE_PERSON,
  AttioIntent.CREATE_DEAL,
];

/**
 * Check if an intent is a valid AttioIntent.
 */
export function isAttioIntent(intent: string): intent is AttioIntent {
  return Object.values(AttioIntent).includes(intent as AttioIntent);
}

/**
 * Human-readable labels for each intent.
 */
export const INTENT_LABELS: Record<AttioIntent, string> = {
  [AttioIntent.CREATE_PERSON]: "Create Person",
  [AttioIntent.CREATE_COMPANY]: "Create Company",
  [AttioIntent.CREATE_DEAL]: "Create Deal",
  [AttioIntent.CREATE_TASK]: "Create Task",
  [AttioIntent.ADD_NOTE]: "Add Note",
  [AttioIntent.ADD_TO_LIST]: "Add to List",
};

/**
 * Emoji icons for each intent.
 */
export const INTENT_EMOJIS: Record<AttioIntent, string> = {
  [AttioIntent.CREATE_PERSON]: "👤",
  [AttioIntent.CREATE_COMPANY]: "🏢",
  [AttioIntent.CREATE_DEAL]: "💰",
  [AttioIntent.CREATE_TASK]: "📋",
  [AttioIntent.ADD_NOTE]: "📝",
  [AttioIntent.ADD_TO_LIST]: "📋",
};

/**
 * Get formatted label with emoji for an intent.
 */
export function getIntentDisplayLabel(intent: AttioIntent): string {
  return `${INTENT_EMOJIS[intent]} ${INTENT_LABELS[intent]}`;
}
