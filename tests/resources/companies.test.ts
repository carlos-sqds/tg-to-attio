/**
 * Companies resource tests.
 * Tests Attio company creation with all field combinations.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { AttioTestClient, uniqueTestName } from "../helpers/attio-test-client";

describe("Companies resource", () => {
  let client: AttioTestClient;

  beforeAll(async () => {
    if (!process.env.ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY environment variable is not set");
    }
    client = new AttioTestClient();
    // Validate API key works
    await client.searchRecords("companies", "test");
  });

  afterAll(async () => {
    if (client) {
      await client.cleanup();
    }
  });

  it("creates company with name only", async () => {
    const name = uniqueTestName("Simple Co");
    const result = await client.createCompany({ name });
    expect(result.recordId).toBeDefined();

    const company = await client.getCompany(result.recordId);
    expect(company).toBeDefined();
  });

  it("creates company with domain", async () => {
    const name = uniqueTestName("Domain Co");
    const domain = `test-domain-${Date.now()}.com`;
    const result = await client.createCompany({ name, domain });

    const company = await client.getCompany(result.recordId);
    const values = company.values as Record<string, unknown>;
    const domains = values.domains as Array<{ domain: string }>;

    expect(domains).toBeDefined();
    expect(domains.some((d) => d.domain === domain)).toBe(true);
  });

  it("creates company with location", async () => {
    const name = uniqueTestName("Location Co");
    const location = "San Francisco, CA";
    const result = await client.createCompany({ name, location });
    expect(result.recordId).toBeDefined();

    const company = await client.getCompany(result.recordId);
    expect(company).toBeDefined();
  });

  it("creates company with description", async () => {
    const name = uniqueTestName("Described Co");
    const description = "A test company for integration testing";
    const result = await client.createCompany({ name, description });
    expect(result.recordId).toBeDefined();

    const company = await client.getCompany(result.recordId);
    expect(company).toBeDefined();
  });

  it("creates company with all fields", async () => {
    const name = uniqueTestName("Full Company");
    const domain = `full-company-${Date.now()}.com`;
    const location = "New York, NY";
    const description = "A complete test company";

    const result = await client.createCompany({
      name,
      domain,
      location,
      description,
    });

    expect(result.recordId).toBeDefined();
    expect(result.recordUrl).toContain("attio.com");

    const company = await client.getCompany(result.recordId);
    expect(company).toBeDefined();
  });

  it("returns record URL on creation", async () => {
    const name = uniqueTestName("URL Co");
    const result = await client.createCompany({ name });

    expect(result.recordUrl).toBeDefined();
    expect(result.recordUrl).toContain("attio.com");
  });

  // Skip: Search indexing can take time, causing flaky tests
  it.skip("can search for created company", async () => {
    const name = uniqueTestName("Searchable Co");
    await client.createCompany({ name });

    // Search for the company
    const results = await client.searchRecords("companies", `[TEST] ${name}`);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.name?.includes(name))).toBe(true);
  });
});
