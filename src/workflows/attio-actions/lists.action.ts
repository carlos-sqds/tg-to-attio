/**
 * List operations for Attio CRM.
 */

import { attioRequest, getApiKey, type ActionResult, type AttioEntryResponse } from "./api";

export interface AddToListInput {
  listApiSlug: string;
  recordId: string;
}

export async function addToList(input: AddToListInput): Promise<ActionResult> {
  const apiKey = getApiKey();

  try {
    const response = await attioRequest<AttioEntryResponse>(
      `/lists/${input.listApiSlug}/entries`,
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            record_id: input.recordId,
          },
        }),
      }
    );

    return {
      success: true,
      recordId: response.data.id.entry_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
