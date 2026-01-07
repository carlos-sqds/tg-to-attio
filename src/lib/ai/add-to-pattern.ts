/**
 * Code-level enforcement for "add to X" pattern.
 *
 * LLMs are non-deterministic - even with explicit prompt instructions,
 * they sometimes don't follow the "add to X should ask clarification" rule.
 * This module provides a safety net that ensures consistent behavior.
 */

import type { SuggestedAction, Clarification } from "@/src/services/attio/schema-types";

/**
 * Regex to detect "add to X" pattern.
 * Matches: "add to <name>", "add to <name> - notes", "ADD TO <name>"
 * Does NOT match: "add note to", "add company", "create task"
 */
const ADD_TO_PATTERN = /^add\s+to\s+(\S+)/i;

/**
 * Intents that indicate the AI created a record instead of asking clarification.
 * When "add to X" is detected and AI returns one of these, we need to intervene.
 */
const CREATION_INTENTS = ["create_company", "create_person", "create_deal"];

/**
 * Standard clarification for ambiguous "add to X" targets.
 */
function createTargetTypeClarification(targetName: string): Clarification {
  return {
    field: "target_type",
    question: `Is '${targetName}' a list, company, or person?`,
    options: ["List", "Company", "Person"],
    reason: "ambiguous",
  };
}

/**
 * Enforce the "add to X" pattern behavior.
 *
 * If instruction matches "add to <name>" and AI returned a creation intent
 * without asking for clarification, transform the response to ask for
 * clarification about target type.
 *
 * @param action - The AI's suggested action
 * @param instruction - The user's instruction
 * @returns Modified action with clarification if needed, original otherwise
 */
export function enforceAddToPattern(action: SuggestedAction, instruction: string): SuggestedAction {
  if (!instruction) return action;

  const match = instruction.match(ADD_TO_PATTERN);
  if (!match) return action;

  const targetName = match[1];

  // Check if AI already has a target_type clarification
  const hasTargetTypeClarification = action.clarificationsNeeded.some(
    (c) => c.field === "target_type"
  );

  if (hasTargetTypeClarification) {
    // AI already asked - just ensure intent is add_note
    if (action.intent !== "add_note") {
      return { ...action, intent: "add_note" };
    }
    return action;
  }

  // Check if AI returned a creation intent without asking
  if (CREATION_INTENTS.includes(action.intent)) {
    return {
      ...action,
      intent: "add_note",
      clarificationsNeeded: [
        createTargetTypeClarification(targetName),
        ...action.clarificationsNeeded,
      ],
    };
  }

  return action;
}
