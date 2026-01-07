/**
 * Search operations for Attio CRM.
 */

import type { SearchResult } from "@/src/lib/types/session.types";
import { attioRequest, getApiKey } from "./api";

export async function searchRecords(objectSlug: string, query: string): Promise<SearchResult[]> {
  const apiKey = getApiKey();

  const response = await attioRequest<{
    data: Array<{
      id: { record_id: string };
      object_slug: string;
      record_text: string;
      domains?: string[];
    }>;
  }>("/objects/records/search", apiKey, {
    method: "POST",
    body: JSON.stringify({
      query,
      objects: [objectSlug],
      request_as: { type: "workspace" },
      limit: 10,
    }),
  });

  return response.data.map((record) => ({
    id: record.id.record_id,
    name: record.record_text || "Unknown",
    extra: record.domains?.[0],
  }));
}
