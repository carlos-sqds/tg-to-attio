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
 * Filter results to only include good matches.
 * Uses word-level matching to ensure "p2p" matches "P2P Staking" but not "CFX Labs".
 */
function filterByRelevance(results: SearchResult[], query: string): SearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();

  return results.filter((r) => {
    // Check if query appears as a word or domain
    const nameLower = r.name.toLowerCase();
    const domainLower = (r.extra || "").toLowerCase();

    // Exact substring match in name or domain
    if (nameLower.includes(normalizedQuery) || domainLower.includes(normalizedQuery)) {
      return true;
    }

    // Word-level fuzzy match (handles "p2p" → "P2P Staking")
    const match = calculateBestWordMatch(normalizedQuery, r.name);
    return match.score >= 0.8; // Stricter threshold for relevance
  });
}

/**
 * Common TLDs to try when searching by domain.
 */
const COMMON_TLDS = [".com", ".org", ".io", ".xyz", ".co"];

/**
 * Deduplicate search results by ID.
 */
function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/**
 * Search records with fuzzy matching and domain fallback.
 *
 * Strategy:
 * 1. Try exact search with query, filter results
 * 2. Try search with stripped company suffixes
 * 3. For short queries, try domain variations (p2p → p2p.com, p2p.org, etc.)
 * 4. For short queries, try broader prefix search
 *
 * All results are filtered through relevance matching.
 */
export async function searchRecords(objectSlug: string, query: string): Promise<SearchResult[]> {
  const strippedQuery = stripCompanySuffixes(query);

  // First try exact search
  let results = await attioSearchApi(objectSlug, query);
  let filtered = filterByRelevance(results, strippedQuery);
  if (filtered.length > 0) return filtered;

  // Try stripped query if different
  if (strippedQuery !== query.toLowerCase().trim()) {
    results = await attioSearchApi(objectSlug, strippedQuery);
    filtered = filterByRelevance(results, strippedQuery);
    if (filtered.length > 0) return filtered;
  }

  // For short queries that look like domain prefixes, try domain variations
  // This handles "p2p" → search for "p2p.com", "p2p.org", etc.
  if (
    strippedQuery.length >= 2 &&
    strippedQuery.length <= 10 &&
    /^[a-z0-9-]+$/i.test(strippedQuery)
  ) {
    const domainSearches = COMMON_TLDS.map((tld) =>
      attioSearchApi(objectSlug, strippedQuery + tld)
    );
    const domainResults = await Promise.all(domainSearches);
    const combinedDomainResults = dedupeResults(domainResults.flat());
    filtered = filterByRelevance(combinedDomainResults, strippedQuery);
    if (filtered.length > 0) return filtered;
  }

  // For short queries, try broader prefix search
  if (strippedQuery.length >= 2 && strippedQuery.length <= 6) {
    const broadQuery = strippedQuery.slice(0, Math.min(3, strippedQuery.length));
    const broadResults = await attioSearchApi(objectSlug, broadQuery);
    return filterByRelevance(broadResults, strippedQuery);
  }

  return [];
}
