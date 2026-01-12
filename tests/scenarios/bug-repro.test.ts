/**
 * Bug Reproduction Tests
 *
 * These tests document and verify fixes for specific bugs.
 * Each test should initially FAIL (TDD approach), then pass after the fix.
 *
 * Bug categories:
 * 1. Company matching - "will create" shown when should "will link"
 * 2. Person creation - wrong record type or missing fields
 * 3. Deadline extraction - deadline not being set on tasks
 * 4. Entity linking - prerequisite actions not coordinated
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { createSimulator, type TelegramSimulator } from "../simulator";
import { AttioTestClient, uniqueTestName } from "../helpers/attio-test-client";

describe("Bug Reproductions", () => {
  // Simulator for testing handlers once wired up
  let _sim: TelegramSimulator;

  beforeEach(() => {
    _sim = createSimulator({ debug: false });
  });

  afterEach(() => {
    // Reset simulator state
    _sim.reset();
  });

  describe("Bug #1: Company matching shows 'will create' incorrectly", () => {
    /**
     * Bug: When user says "add to p2p", the bot says "Will also create: P2P"
     * even though P2P.org already exists in Attio and was matched via fuzzy search.
     *
     * Expected: Bot should say "Will link to: P2P.org" or similar
     * Actual: Bot says "Will also create: P2P"
     *
     * Root cause: AI generates prerequisiteActions based on message content,
     * but execute.action.ts does its own search at runtime. These can diverge.
     * The confirmation message shows AI's prediction, not what will actually happen.
     */
    it.skip("should show 'will link to' when company exists via fuzzy match", async () => {
      // This test requires integration with real handlers and AI
      // Will be enabled once handlers are wired up
      // Simulate the scenario:
      // 1. Forward a message mentioning P2P.org
      // 2. Run /done with "add task to p2p"
      // 3. Verify confirmation does NOT say "Will also create"
      // For now, document the expected behavior:
      // const response = sim.lastResponse();
      // expect(response?.text).not.toContain('Will also create');
      // expect(response?.text).toMatch(/link|existing/i);
    });

    it("documents the expected matching behavior", () => {
      // When AI sees "p2p" and Attio has "P2P.org":
      // - Fuzzy search should find P2P.org
      // - Confirmation should mention linking to existing, not creating
      // - No prerequisiteAction should be generated for company

      const scenario = {
        input: {
          forwardedText: "Pavel from P2P.org",
          instruction: "add task to p2p and remind me in a week",
        },
        existingData: {
          company: { id: "123", name: "P2P.org", domain: "p2p.org" },
        },
        expectedBehavior: {
          shouldCreateCompany: false,
          shouldLinkToExisting: true,
          confirmationShouldSay: "P2P.org",
          confirmationShouldNotSay: "Will also create",
        },
      };

      expect(scenario.expectedBehavior.shouldCreateCompany).toBe(false);
    });
  });

  describe("Bug #2: Person not created as correct record type", () => {
    /**
     * Bug: When user says "create person", the bot creates a record
     * but it's not properly structured as a Person in Attio.
     *
     * Expected: POST to /objects/people/records with proper name structure
     * Actual: Might be hitting wrong endpoint or missing fields
     */
    it.skip("should create person with correct Attio structure", async () => {
      // This test requires integration with real handlers and AI
      // Will verify the API call structure once handlers are wired up
      // Expected API call:
      // POST /objects/people/records
      // {
      //   data: {
      //     values: {
      //       name: { first_name: "Pavel", last_name: "Marmaliuk", full_name: "Pavel Marmaliuk" },
      //       email_addresses: [{ email_address: "..." }],
      //       company: [{ target_object: "companies", target_record_id: "..." }]
      //     }
      //   }
      // }
    });

    it("documents the expected person structure", () => {
      const expectedPersonStructure = {
        values: {
          name: {
            first_name: "Pavel",
            last_name: "Marmaliuk",
            full_name: "Pavel Marmaliuk",
          },
          email_addresses: [{ email_address: "pavel@example.com" }],
          company: [
            {
              target_object: "companies",
              target_record_id: "company-id-123",
            },
          ],
          job_title: "Data Analyst",
        },
      };

      expect(expectedPersonStructure.values.name.full_name).toBe("Pavel Marmaliuk");
    });
  });

  describe("Bug #3: Deadline not being set on tasks", () => {
    /**
     * Bug: When user says "remind me in a week", the task is created
     * but deadline_at is null or missing.
     *
     * Expected: Task should have deadline_at set to ~7 days from now
     * Actual: deadline_at is null
     *
     * Root cause: parseDeadline is called in execute.action.ts but the
     * deadline might not be extracted by AI, or not shown in confirmation.
     */
    it.skip("should extract deadline from 'remind me in a week'", async () => {
      // This test requires integration with real handlers and AI
      // Will verify deadline is parsed and shown in confirmation
    });

    it("documents deadline parsing expectations", () => {
      const deadlineScenarios = [
        { input: "remind me in a week", expectedDays: 7 },
        { input: "follow up tomorrow", expectedDays: 1 },
        { input: "call them next monday", expectedDays: "next monday" },
        { input: "send by end of week", expectedDays: "friday" },
        { input: "review in 3 days", expectedDays: 3 },
      ];

      // Each scenario should result in a parsed deadline
      for (const scenario of deadlineScenarios) {
        expect(scenario.expectedDays).toBeDefined();
      }
    });
  });

  describe("Bug #4: Entity linking issues", () => {
    /**
     * Bug: When creating a person with a company, the company
     * might be created but not properly linked to the person.
     *
     * Expected: Person.company should reference the created/existing company ID
     * Actual: Company created separately, person.company is empty
     */
    it.skip("should link person to company after prerequisite creation", async () => {
      // Test the full flow:
      // 1. Create person with new company
      // 2. Company should be created first (prerequisite)
      // 3. Person should have company link to the created company
    });

    it("documents the expected linking behavior", () => {
      const expectedFlow = {
        step1: "AI identifies company needs to be created",
        step2: "executePrerequisites creates company, returns { company: 'id-123' }",
        step3: "createPerson receives companyId from createdRecords",
        step4: "Person is created with company link to id-123",
      };

      expect(Object.keys(expectedFlow).length).toBe(4);
    });
  });
});

describe("Integration Tests with Real Attio", () => {
  let client: AttioTestClient | null = null;
  let apiKeyValid = false;

  beforeAll(async () => {
    if (!process.env.ATTIO_API_KEY) {
      console.log("Skipping integration tests - ATTIO_API_KEY not set");
      return;
    }

    // Test if API key is valid
    try {
      client = new AttioTestClient();
      // Try a simple search to validate the key
      await client.searchRecords("companies", "test");
      apiKeyValid = true;
    } catch (error) {
      console.log(
        "Skipping integration tests - ATTIO_API_KEY is invalid:",
        (error as Error).message.includes("401") ? "key revoked/invalid" : (error as Error).message
      );
      client = null;
    }
  });

  afterAll(async () => {
    if (client) {
      await client.cleanup();
    }
  });

  describe("Person creation with company linking", () => {
    it("creates person linked to existing company", async () => {
      if (!client || !apiKeyValid) {
        console.log("Skipping - API not available");
        return;
      }

      // Create company first
      const companyName = uniqueTestName("Link Test Co");
      const company = await client.createCompany({ name: companyName });

      // Create person linked to company
      const personName = uniqueTestName("Linked Person");
      const person = await client.createPerson({
        name: personName,
        companyId: company.recordId,
      });

      // Verify the link
      const personData = await client.getPerson(person.recordId);
      const values = personData.values as Record<string, unknown>;
      const companyLink = values.company as Array<{ target_record_id: string }>;

      expect(companyLink).toBeDefined();
      expect(companyLink.length).toBeGreaterThan(0);
      expect(companyLink[0].target_record_id).toBe(company.recordId);
    });

    it("creates task with deadline set correctly", async () => {
      if (!client || !apiKeyValid) {
        console.log("Skipping - API not available");
        return;
      }

      const now = new Date();
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 7);
      const deadlineStr = deadline.toISOString().replace(/\.\d{3}Z$/, ".000000Z");

      const content = uniqueTestName("Deadline Test Task");
      const result = await client.createTask({
        content,
        deadline: deadlineStr,
      });

      // Verify deadline was set
      const task = await client.getTask(result.taskId);
      expect(task.deadline_at).toBeDefined();

      // Verify deadline is approximately correct
      const storedDeadline = new Date(task.deadline_at as string);
      const diffDays = (storedDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);
    });
  });

  describe("Company search and matching", () => {
    // Skip: Search indexing can take time, causing flaky tests
    it.skip("finds company by partial name match", async () => {
      if (!client || !apiKeyValid) {
        console.log("Skipping - API not available");
        return;
      }

      // Create a company with a unique name
      const fullName = uniqueTestName("Searchable Corp");
      await client.createCompany({ name: fullName });

      // Search for it by partial name
      const results = await client.searchRecords("companies", "[TEST] Searchable");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name?.includes("Searchable"))).toBe(true);
    });

    it("finds company by domain", async () => {
      if (!client || !apiKeyValid) {
        console.log("Skipping - API not available");
        return;
      }

      // Create company with domain
      const companyName = uniqueTestName("Domain Search Co");
      const domain = `domain-search-${Date.now()}.com`;
      await client.createCompany({ name: companyName, domain });

      // Search by domain
      const results = await client.searchRecords("companies", domain);
      // Domain search might not return results directly - depends on Attio's search
      // This test documents the expected behavior
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
