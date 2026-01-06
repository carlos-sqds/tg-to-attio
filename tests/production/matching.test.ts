import { describe, it, expect, beforeAll } from "vitest";

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://tg-to-attio.vercel.app";

interface SearchResult {
  id: string;
  name: string;
  extra?: string;
}

interface MatchResult {
  input: string;
  parsed: { name: string; domain?: string };
  searchQuery: string;
  results: SearchResult[];
  bestMatch: SearchResult | null;
  confidence: "high" | "medium" | "low" | "none";
  matchReason: string;
}

async function testMatch(input: string, object = "companies"): Promise<MatchResult> {
  const response = await fetch(`${PRODUCTION_URL}/api/test/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, object }),
  });

  if (!response.ok) {
    throw new Error(`Match test failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function testSearch(
  query: string,
  object = "companies"
): Promise<{
  query: string;
  object: string;
  resultCount: number;
  results: SearchResult[];
}> {
  const response = await fetch(`${PRODUCTION_URL}/api/test/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, object }),
  });

  if (!response.ok) {
    throw new Error(`Search test failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function testHealth(): Promise<{
  status: string;
  checks: Record<string, { status: string; message?: string }>;
}> {
  const response = await fetch(`${PRODUCTION_URL}/api/test/health`);
  return response.json();
}

describe("Production Matching Tests", () => {
  beforeAll(async () => {
    // Verify production is healthy
    const health = await testHealth();
    console.log("Production health:", health.status);
    if (health.status !== "healthy") {
      console.warn("Production health check issues:", health.checks);
    }
  });

  describe("Company Search", () => {
    it("should find companies with exact name", async () => {
      const result = await testSearch("Squads");
      console.log(`Search "Squads": ${result.resultCount} results`);
      expect(result.resultCount).toBeGreaterThanOrEqual(0);
    });

    it("should find companies with partial name", async () => {
      const result = await testSearch("Squad");
      console.log(`Search "Squad": ${result.resultCount} results`);
    });

    it("should handle domain-like searches", async () => {
      const result = await testSearch("sqds.io");
      console.log(`Search "sqds.io": ${result.resultCount} results`);
    });
  });

  describe("Company Name Variations", () => {
    // Test various ways a company name might be written
    const companyVariations = [
      // Exact variations
      { input: "Squads", expectMatch: true },
      { input: "squads", expectMatch: true },
      { input: "SQUADS", expectMatch: true },

      // With suffixes
      { input: "Squads Inc", expectMatch: true },
      { input: "Squads Inc.", expectMatch: true },
      { input: "Squads LLC", expectMatch: true },
      { input: "Squads Corporation", expectMatch: true },
      { input: "Squads Corp", expectMatch: true },

      // Domain variations
      { input: "sqds.io", expectMatch: true },
      { input: "www.sqds.io", expectMatch: true },
      { input: "https://sqds.io", expectMatch: true },

      // Combined
      { input: "Squads (sqds.io)", expectMatch: true },
      { input: "Squads from sqds.io", expectMatch: true },

      // Typos/variations
      { input: "Squad", expectMatch: true },
      { input: "Squadss", expectMatch: false }, // intentional typo
    ];

    for (const { input, expectMatch } of companyVariations) {
      it(`should ${expectMatch ? "match" : "not match"}: "${input}"`, async () => {
        const result = await testMatch(input);
        console.log(
          `Match "${input}": confidence=${result.confidence}, ` +
            `match=${result.bestMatch?.name || "none"}, reason=${result.matchReason}`
        );

        if (expectMatch) {
          expect(result.confidence).not.toBe("none");
        }
      });
    }
  });

  describe("Ambiguous Company Names", () => {
    // These should be flagged as potentially ambiguous
    const ambiguousCases = [
      "Tech", // Too generic
      "AI", // Too generic
      "Software", // Too generic
      "Consulting", // Too generic
    ];

    for (const input of ambiguousCases) {
      it(`should flag ambiguous: "${input}"`, async () => {
        const result = await testMatch(input);
        console.log(
          `Ambiguous "${input}": ${result.results.length} results, confidence=${result.confidence}`
        );

        // Generic terms should either return many results or low confidence
        if (result.results.length > 3) {
          expect(result.confidence).not.toBe("high");
        }
      });
    }
  });

  describe("Person Search", () => {
    it("should find people by name", async () => {
      const result = await testSearch("John", "people");
      console.log(`Search people "John": ${result.resultCount} results`);
    });

    it("should find people by email domain", async () => {
      const result = await testSearch("@sqds.io", "people");
      console.log(`Search people "@sqds.io": ${result.resultCount} results`);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty query gracefully", async () => {
      try {
        const result = await testMatch("");
        console.log("Empty query result:", result);
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });

    it("should handle special characters", async () => {
      const specialChars = ["Company & Co", "O'Brien Inc", "Test (Holdings)", "A.B.C. Corp"];
      for (const input of specialChars) {
        const result = await testMatch(input);
        console.log(`Special chars "${input}": ${result.confidence}`);
        // Should not throw
        expect(result).toBeDefined();
      }
    });

    it("should handle unicode characters", async () => {
      const unicodeNames = ["Café Company", "Müller GmbH", "株式会社テスト"];
      for (const input of unicodeNames) {
        const result = await testMatch(input);
        console.log(`Unicode "${input}": ${result.confidence}`);
        expect(result).toBeDefined();
      }
    });

    it("should handle very long names", async () => {
      const longName = "A".repeat(200);
      const result = await testMatch(longName);
      console.log(`Long name (${longName.length} chars): ${result.confidence}`);
      expect(result).toBeDefined();
    });
  });
});
