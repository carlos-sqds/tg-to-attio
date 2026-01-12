/**
 * Cleanup script for orphaned test data in Attio.
 * Searches for and deletes any records with [TEST] prefix.
 *
 * Usage: npm run test:cleanup
 */

import "dotenv/config";

const ATTIO_BASE_URL = "https://api.attio.com/v2";
const TEST_PREFIX = "[TEST]";

async function attioRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) {
    throw new Error("ATTIO_API_KEY not configured");
  }

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

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

async function searchRecords(
  objectSlug: string,
  query: string
): Promise<Array<{ id: string; name?: string }>> {
  const response = await attioRequest<{
    data: Array<{
      id: { record_id: string };
      values?: { name?: unknown };
    }>;
  }>("/objects/records/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      objects: [objectSlug],
      request_as: { type: "workspace" },
      limit: 100,
    }),
  });

  return response.data.map((r) => ({
    id: r.id.record_id,
    name:
      typeof r.values?.name === "string"
        ? r.values.name
        : (r.values?.name as { full_name?: string })?.full_name,
  }));
}

async function deleteRecord(objectSlug: string, recordId: string): Promise<void> {
  await attioRequest(`/objects/${objectSlug}/records/${recordId}`, {
    method: "DELETE",
  });
}

async function cleanupTestData(): Promise<void> {
  console.log("🧹 Starting test data cleanup...\n");

  const objects = ["people", "companies", "deals"];
  let totalDeleted = 0;

  for (const obj of objects) {
    console.log(`Searching for test ${obj}...`);
    const records = await searchRecords(obj, TEST_PREFIX);

    if (records.length === 0) {
      console.log(`  No test ${obj} found.\n`);
      continue;
    }

    console.log(`  Found ${records.length} test ${obj}:`);

    for (const record of records) {
      try {
        await deleteRecord(obj, record.id);
        console.log(`    ✓ Deleted: ${record.name || record.id}`);
        totalDeleted++;
      } catch (error) {
        console.log(`    ✗ Failed to delete ${record.id}:`, error);
      }
    }
    console.log();
  }

  // Note: Tasks and notes are harder to search for by prefix
  // They would need to be deleted via the Attio UI or API listing

  console.log(`\n✅ Cleanup complete. Deleted ${totalDeleted} records.`);
}

// Run cleanup
cleanupTestData().catch(console.error);
