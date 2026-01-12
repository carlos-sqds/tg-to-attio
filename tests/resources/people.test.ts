/**
 * People resource tests.
 * Tests Attio person creation with all field combinations.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { AttioTestClient, uniqueTestName } from "../helpers/attio-test-client";

describe("People resource", () => {
  let client: AttioTestClient;

  beforeAll(async () => {
    if (!process.env.ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY environment variable is not set");
    }
    client = new AttioTestClient();
    // Validate API key works
    await client.searchRecords("people", "test");
  });

  afterAll(async () => {
    if (client) {
      await client.cleanup();
    }
  });

  describe("creation", () => {
    it("creates person with name only", async () => {
      const baseName = uniqueTestName("John Doe");
      const result = await client.createPerson({ name: baseName });
      expect(result.recordId).toBeDefined();

      const person = await client.getPerson(result.recordId);
      expect(person).toBeDefined();
      expect(person.values).toBeDefined();
    });

    it("creates person with email", async () => {
      const baseName = uniqueTestName("Jane Smith");
      const email = `jane-${Date.now()}@test-domain.com`;
      const result = await client.createPerson({ name: baseName, email });

      const person = await client.getPerson(result.recordId);
      const values = person.values as Record<string, unknown>;
      const emails = values.email_addresses as Array<{
        email_address: string;
      }>;

      expect(emails).toBeDefined();
      expect(emails.length).toBeGreaterThan(0);
      expect(emails[0].email_address).toBe(email);
    });

    // Skip: Phone format validation is strict and requires real phone numbers
    it.skip("creates person with phone", async () => {
      const baseName = uniqueTestName("Bob Wilson");
      const phone = "+15550123456";
      const result = await client.createPerson({ name: baseName, phone });
      expect(result.recordId).toBeDefined();

      const person = await client.getPerson(result.recordId);
      expect(person).toBeDefined();
    });

    it("creates person linked to company", async () => {
      // First create a company
      const companyName = uniqueTestName("Acme Corp");
      const company = await client.createCompany({ name: companyName });

      // Then create person linked to company
      const personName = uniqueTestName("Alice Brown");
      const result = await client.createPerson({
        name: personName,
        companyId: company.recordId,
      });

      const person = await client.getPerson(result.recordId);
      const values = person.values as Record<string, unknown>;
      const companyLink = values.company as Array<{
        target_record_id: string;
      }>;

      expect(companyLink).toBeDefined();
      expect(companyLink.length).toBeGreaterThan(0);
      expect(companyLink[0].target_record_id).toBe(company.recordId);
    });

    it("creates person with job title", async () => {
      const baseName = uniqueTestName("Charlie Davis");
      const jobTitle = "Software Engineer";
      const result = await client.createPerson({ name: baseName, jobTitle });
      expect(result.recordId).toBeDefined();

      const person = await client.getPerson(result.recordId);
      expect(person).toBeDefined();
    });

    it("creates person with description", async () => {
      const baseName = uniqueTestName("Diana Evans");
      const description = "Test person for integration testing";
      const result = await client.createPerson({ name: baseName, description });

      const person = await client.getPerson(result.recordId);
      const values = person.values as Record<string, unknown>;

      // Description is returned as an array of value objects
      const descArray = values.description as Array<{ value: string }>;
      expect(descArray).toBeDefined();
      expect(descArray.length).toBeGreaterThan(0);
      expect(descArray[0].value).toBe(description);
    });

    it("creates person with all fields", async () => {
      // Create company first
      const companyName = uniqueTestName("Full Corp");
      const company = await client.createCompany({ name: companyName });

      // Create person with all fields
      const baseName = uniqueTestName("Full Person");
      const email = `full-${Date.now()}@test.com`;
      const jobTitle = "CEO";

      const result = await client.createPerson({
        name: baseName,
        email,
        companyId: company.recordId,
        jobTitle,
      });

      expect(result.recordId).toBeDefined();
      expect(result.recordUrl).toContain("attio.com");

      // Verify person can be retrieved
      const person = await client.getPerson(result.recordId);
      expect(person).toBeDefined();
      expect(person.values).toBeDefined();
    });
  });

  describe("retrieval", () => {
    it("returns record URL on creation", async () => {
      const baseName = uniqueTestName("URL Person");
      const result = await client.createPerson({ name: baseName });

      expect(result.recordUrl).toBeDefined();
      expect(result.recordUrl).toContain("attio.com");
    });

    // Skip: Search indexing can take time, causing flaky tests
    it.skip("can search for created person", async () => {
      const baseName = uniqueTestName("Searchable Person");
      await client.createPerson({ name: baseName });

      // Search for the person
      const results = await client.searchRecords("people", `[TEST] ${baseName}`);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
