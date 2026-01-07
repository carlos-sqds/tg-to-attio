/**
 * Integration test for fuzzy company search.
 *
 * Tests that short queries like "p2p" correctly match companies
 * with similar names like "P2P Staking" using word-level matching.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env" });

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const API_BASE = "https://api.attio.com/v2";

describe("Fuzzy Company Search", () => {
  let testCompanyId: string | null = null;

  beforeAll(async () => {
    if (!ATTIO_API_KEY) {
      console.log("Skipping test - no ATTIO_API_KEY");
      return;
    }

    // Create a test company "P2P Staking" to search for
    const response = await fetch(`${API_BASE}/objects/companies/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ATTIO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          values: {
            name: [{ value: "P2P Staking Test Co" }],
          },
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      testCompanyId = data.data.id.record_id;
      console.log(`Created test company: ${testCompanyId}`);
    } else {
      console.log("Failed to create test company:", await response.text());
    }
  });

  afterAll(async () => {
    // Clean up test company
    if (testCompanyId && ATTIO_API_KEY) {
      await fetch(`${API_BASE}/objects/companies/records/${testCompanyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ATTIO_API_KEY}`,
        },
      });
      console.log(`Deleted test company: ${testCompanyId}`);
    }
  });

  it("should find 'P2P Staking Test Co' when searching for 'p2p'", async () => {
    if (!ATTIO_API_KEY || !testCompanyId) {
      console.log("Skipping - test company not created");
      return;
    }

    // Wait a moment for the record to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Import the searchRecords function
    const { searchRecords } = await import("@/src/workflows/attio-actions/search.action");

    // Search for "p2p"
    const results = await searchRecords("companies", "p2p");

    console.log("Search results for 'p2p':", results);

    // Should find our test company
    const found = results.some(
      (r) => r.name.toLowerCase().includes("p2p") || r.name.toLowerCase().includes("staking")
    );

    expect(found).toBe(true);
  }, 30000);

  it("should use fuzzy matching for short queries", async () => {
    // Test the fuzzy matching utilities directly
    const { calculateBestWordMatch, stripCompanySuffixes } =
      await import("@/src/lib/matching/company");

    // "p2p" should match "p2p" in "P2P Staking" with high score
    const match1 = calculateBestWordMatch("p2p", "P2P Staking");
    expect(match1.score).toBeGreaterThanOrEqual(0.9); // Should be exact word match

    // "p2p" should match "p2p" in "P2P" with exact score
    const match2 = calculateBestWordMatch("p2p", "P2P");
    expect(match2.score).toBe(1.0); // Exact match

    // Suffix stripping should work
    const stripped = stripCompanySuffixes("Acme Inc.");
    expect(stripped).toBe("acme");
  });
});
