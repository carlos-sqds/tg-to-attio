/**
 * Handle target_type clarification resolution.
 *
 * When user answers "Is 'X' a List, Company, or Person?", this module:
 * 1. Searches for matches in the selected type
 * 2. If matches found → adds clarification with options
 * 3. If no matches → asks for the full name
 */

import type { SuggestedAction, Clarification } from "@/src/services/attio/schema-types";
import { searchRecords } from "@/src/workflows/attio-actions/search.action";

/**
 * Extract the target name from an "add to X" instruction.
 */
export function extractTargetName(instruction: string): string | null {
  const match = instruction.match(/^add\s+to\s+(\S+)/i);
  return match ? match[1] : null;
}

/**
 * Object type mapping for search.
 */
const TARGET_TYPE_TO_OBJECT: Record<string, string> = {
  company: "companies",
  person: "people",
  list: "lists",
};

/**
 * Process target_type clarification response.
 *
 * After user selects "Company", "Person", or "List", search for matches
 * and return updated action with appropriate next clarification.
 *
 * @param action - Current suggested action
 * @param targetType - User's selection ("Company", "Person", or "List")
 * @param instruction - Original instruction (to extract target name)
 * @returns Updated action with search results or follow-up clarification
 */
export async function resolveTargetType(
  action: SuggestedAction,
  targetType: string,
  instruction: string
): Promise<SuggestedAction> {
  const targetName = extractTargetName(instruction);
  if (!targetName) {
    return action;
  }

  const normalizedType = targetType.toLowerCase();
  const objectSlug = TARGET_TYPE_TO_OBJECT[normalizedType];

  if (!objectSlug) {
    // Unknown type - just return the action as-is
    return action;
  }

  // Search for matches
  const results = await searchRecords(objectSlug, targetName);

  // Remove the target_type clarification since it's been answered
  const remainingClarifications = action.clarificationsNeeded.filter(
    (c) => c.field !== "target_type"
  );

  if (results.length > 0) {
    // Found matches - ask user to select one
    const typeLabel = normalizedType === "person" ? "person" : normalizedType;
    const clarification: Clarification = {
      field: `${normalizedType}_selection`,
      question: `Which ${typeLabel} is "${targetName}"?`,
      options: results.slice(0, 5).map((r) => r.name),
      reason: "multiple_matches",
    };

    return {
      ...action,
      intent: normalizedType === "list" ? "add_to_list" : "add_note",
      targetObject: objectSlug,
      clarificationsNeeded: [clarification, ...remainingClarifications],
      extractedData: {
        ...action.extractedData,
        search_results: results, // Store for later use
        target_type: normalizedType,
      },
    };
  } else {
    // No matches - ask for full name
    const typeLabel = normalizedType;
    const clarification: Clarification = {
      field: `${normalizedType}_name`,
      question: `No ${typeLabel} found matching "${targetName}". What is the full ${typeLabel} name?`,
      reason: "not_found",
    };

    return {
      ...action,
      intent: normalizedType === "list" ? "add_to_list" : "add_note",
      targetObject: objectSlug,
      clarificationsNeeded: [clarification, ...remainingClarifications],
      extractedData: {
        ...action.extractedData,
        target_type: normalizedType,
        original_target: targetName,
      },
    };
  }
}

/**
 * Check if this is a target_type clarification being answered.
 */
export function isTargetTypeClarification(field: string): boolean {
  return field === "target_type";
}

/**
 * Check if the option is a valid target type.
 */
export function isValidTargetType(option: string): boolean {
  const normalized = option.toLowerCase();
  return ["company", "person", "list"].includes(normalized);
}

/**
 * Selection clarification fields that need special handling.
 */
const SELECTION_FIELDS = ["company_selection", "person_selection", "list_selection"];

/**
 * Check if this is a selection clarification (user picking from search results).
 */
export function isSelectionClarification(field: string): boolean {
  return SELECTION_FIELDS.includes(field);
}

/**
 * Process selection clarification response.
 *
 * When user selects a company/person/list from search results,
 * map the selection to the appropriate extracted data fields.
 *
 * @param action - Current suggested action
 * @param field - The clarification field (company_selection, person_selection, list_selection)
 * @param selectedName - The name user selected
 * @returns Updated action with proper extracted data
 */
export function resolveSelection(
  action: SuggestedAction,
  field: string,
  selectedName: string
): SuggestedAction {
  // Get stored search results
  const searchResults = action.extractedData.search_results as
    | Array<{ id: string; name: string; extra?: string }>
    | undefined;

  // Find the selected record in search results
  const selectedRecord = searchResults?.find(
    (r) => r.name.toLowerCase() === selectedName.toLowerCase()
  );

  // Remove the selection clarification
  const remainingClarifications = action.clarificationsNeeded.filter((c) => c.field !== field);

  // Map to appropriate extracted data based on field type
  const updatedData = { ...action.extractedData };

  if (field === "company_selection") {
    updatedData.company = selectedName;
    if (selectedRecord) {
      updatedData.parent_record_id = selectedRecord.id;
      updatedData.parent_object = "companies";
    }
  } else if (field === "person_selection") {
    updatedData.person = selectedName;
    if (selectedRecord) {
      updatedData.parent_record_id = selectedRecord.id;
      updatedData.parent_object = "people";
    }
  } else if (field === "list_selection") {
    updatedData.list = selectedName;
    if (selectedRecord) {
      updatedData.list_id = selectedRecord.id;
    }
  }

  // Clean up internal fields
  delete updatedData.search_results;

  return {
    ...action,
    extractedData: updatedData,
    clarificationsNeeded: remainingClarifications,
  };
}
