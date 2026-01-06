import { kv } from "@vercel/kv";
import type { AttioSchema } from "@/src/services/attio/schema-types";

/**
 * KV key for cached Attio schema.
 * Global cache (not per-chat) since schema is workspace-wide.
 */
const SCHEMA_KEY = "attio:schema";

/**
 * Schema cache TTL in seconds (5 minutes).
 */
const SCHEMA_TTL_SECONDS = 300;

/**
 * Cached schema with metadata.
 */
interface CachedSchema {
  schema: AttioSchema;
  cachedAt: number;
}

/**
 * Get cached schema from KV.
 * Returns null if not cached or expired.
 */
export async function getCachedSchema(): Promise<AttioSchema | null> {
  const cached = await kv.get<CachedSchema>(SCHEMA_KEY);
  if (!cached) {
    return null;
  }

  // Check if cache is still valid
  const age = Date.now() - cached.cachedAt;
  const maxAge = SCHEMA_TTL_SECONDS * 1000;

  if (age > maxAge) {
    // Cache expired, delete it
    await kv.del(SCHEMA_KEY);
    return null;
  }

  return cached.schema;
}

/**
 * Cache schema in KV with TTL.
 */
export async function setCachedSchema(schema: AttioSchema): Promise<void> {
  const cached: CachedSchema = {
    schema,
    cachedAt: Date.now(),
  };
  await kv.set(SCHEMA_KEY, cached, { ex: SCHEMA_TTL_SECONDS });
}

/**
 * Clear cached schema from KV.
 */
export async function clearCachedSchema(): Promise<void> {
  await kv.del(SCHEMA_KEY);
}

/**
 * Get schema cache TTL in milliseconds.
 */
export function getSchemaCacheTtlMs(): number {
  return SCHEMA_TTL_SECONDS * 1000;
}
