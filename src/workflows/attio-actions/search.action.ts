/**
 * Search operations for Attio CRM.
 */

import type { SearchResult } from "@/src/lib/types/session.types";
import { stripCompanySuffixes, calculateBestWordMatch } from "@/src/lib/matching/company";
import { attioRequest, getApiKey } from "./api";

/**
 * Raw search against Attio API.
 */
async function attioSearchApi(objectSlug: string, query: string): Promise<SearchResult[]> {
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

/**
 * Search records with fuzzy matching fallback.
 *
 * 1. Try exact search with query
 * 2. Try search with stripped company suffixes
 * 3. For short queries (2-4 chars), try broader search and filter with word matching
 */
export async function searchRecords(objectSlug: string, query: string): Promise<SearchResult[]> {
  const strippedQuery = stripCompanySuffixes(query);

  // First try exact search
  let results = await attioSearchApi(objectSlug, query);
  if (results.length > 0) return results;

  // Try stripped query if different
  if (strippedQuery !== query.toLowerCase().trim()) {
    results = await attioSearchApi(objectSlug, strippedQuery);
    if (results.length > 0) return results;
  }

  // For short queries, try broader search and filter with fuzzy matching
  // This handles cases like "p2p" matching "P2P Staking"
  if (strippedQuery.length >= 2 && strippedQuery.length <= 6) {
    // Try first 2-3 characters as a broader search
    const broadQuery = strippedQuery.slice(0, Math.min(3, strippedQuery.length));
    const broadResults = await attioSearchApi(objectSlug, broadQuery);

    // Filter results where query matches any word at 70%+
    return broadResults.filter((r) => {
      const match = calculateBestWordMatch(strippedQuery, r.name);
      return match.score >= 0.7;
    });
  }

  return [];
}
