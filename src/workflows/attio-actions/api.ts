/**
 * Shared Attio API utilities and types.
 * Used by all action modules for API communication.
 */

import type { ActionResult } from "@/src/services/attio/schema-types";

export const ATTIO_BASE_URL = "https://api.attio.com/v2";

/**
 * Make a request to the Attio API.
 */
export async function attioRequest<T>(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ATTIO_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Attio API error: ${response.status} - ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get the Attio API key from environment.
 * @throws Error if ATTIO_API_KEY is not configured
 */
export function getApiKey(): string {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");
  return apiKey;
}

/**
 * Get the web URL for a record.
 */
export async function getRecordUrl(
  objectSlug: string,
  recordId: string
): Promise<string | undefined> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) return undefined;

  try {
    const response = await attioRequest<{ data: { web_url: string } }>(
      `/objects/${objectSlug}/records/${recordId}`,
      apiKey
    );
    return response.data.web_url;
  } catch {
    return undefined;
  }
}

// ============ Response Types ============

export interface AttioRecordResponse {
  data: {
    id: { record_id: string };
    web_url: string;
  };
}

export interface AttioNoteResponse {
  data: {
    id: { note_id: string };
  };
}

export interface AttioTaskResponse {
  data: {
    id: { task_id: string };
  };
}

export interface AttioEntryResponse {
  data: {
    id: { entry_id: string };
  };
}

// Re-export ActionResult for convenience
export type { ActionResult };
