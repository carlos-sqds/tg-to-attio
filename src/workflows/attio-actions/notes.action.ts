/**
 * Note operations for Attio CRM.
 */

import { attioRequest, getApiKey, type ActionResult, type AttioNoteResponse } from "./api";

export interface CreateNoteInput {
  parentObject: "companies" | "people" | "deals";
  parentRecordId: string;
  title: string;
  content: string;
}

export async function createNote(input: CreateNoteInput): Promise<ActionResult> {
  const apiKey = getApiKey();

  try {
    const response = await attioRequest<AttioNoteResponse>("/notes", apiKey, {
      method: "POST",
      body: JSON.stringify({
        data: {
          parent_object: input.parentObject,
          parent_record_id: input.parentRecordId,
          title: input.title,
          format: "markdown",
          content: input.content,
        },
      }),
    });

    return {
      success: true,
      noteId: response.data.id.note_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
