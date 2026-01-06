import { describe, it, expect, beforeAll } from "vitest";

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://tg-to-attio.vercel.app";

interface IntentResult {
  intent: string;
  confidence: number;
  targetObject: string;
  extractedData: Record<string, unknown>;
  clarificationsNeeded: Array<{ field: string; question: string }>;
  prerequisiteActions?: Array<{ intent: string; extractedData: Record<string, unknown> }>;
  reasoning: string;
}

async function testIntent(
  messages: Array<{ text: string; senderFirstName?: string; chatName?: string }>,
  instruction: string
): Promise<{
  input: { messages: unknown[]; instruction: string };
  result: IntentResult;
  duration: string;
}> {
  const response = await fetch(`${PRODUCTION_URL}/api/test/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, instruction }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Intent test failed: ${response.status} ${text}`);
  }

  return response.json();
}

describe("Production AI Intent Tests", () => {
  beforeAll(async () => {
    // Quick health check
    const response = await fetch(`${PRODUCTION_URL}/api/test/health`);
    const health = await response.json();
    console.log("Production status:", health.status);
  });

  describe("Create Person Intent", () => {
    it("should extract person with email from conversation", async () => {
      const result = await testIntent(
        [
          { text: "Hey, just spoke with John Smith from Acme Corp", senderFirstName: "Alice" },
          { text: "His email is john.smith@acme.com" },
        ],
        "create a person"
      );

      console.log(`Intent: ${result.result.intent}, confidence: ${result.result.confidence}`);
      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("create_person");
      expect(result.result.confidence).toBeGreaterThan(0.5);

      const data = result.result.extractedData;
      expect(data.name || data.full_name).toBeDefined();
      expect(String(data.name || data.full_name).toLowerCase()).toContain("john");
    }, 30000);

    it("should extract person with phone number", async () => {
      const result = await testIntent(
        [{ text: "Contact Maria Garcia at +1-555-123-4567, she's the CTO" }],
        "add person"
      );

      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("create_person");
      const data = result.result.extractedData;
      expect(String(data.name).toLowerCase()).toContain("maria");
      expect(String(data.phone_numbers || data.phone)).toContain("555");
    }, 30000);

    it("should request clarification when company is ambiguous", async () => {
      const result = await testIntent(
        [{ text: "Met Sarah at the conference, she's a product manager" }],
        "create person"
      );

      console.log("Clarifications:", result.result.clarificationsNeeded);

      // Should either extract with low confidence or request clarification
      expect(
        result.result.confidence < 0.7 ||
          result.result.clarificationsNeeded.some((c) => c.field.toLowerCase().includes("company"))
      ).toBe(true);
    }, 30000);
  });

  describe("Create Company Intent", () => {
    it("should extract company from description", async () => {
      const result = await testIntent(
        [{ text: "TechCorp is a startup based in San Francisco, their website is techcorp.io" }],
        "add company"
      );

      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("create_company");
      expect(String(result.result.extractedData.name).toLowerCase()).toContain("techcorp");
    }, 30000);

    it("should extract domain when provided", async () => {
      const result = await testIntent(
        [{ text: "Add the company stripe.com to our CRM" }],
        "create company"
      );

      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("create_company");
      const data = result.result.extractedData;
      expect(String(data.domains || data.domain || "").toLowerCase()).toContain("stripe");
    }, 30000);
  });

  describe("Create Deal Intent", () => {
    it("should extract deal with value", async () => {
      const result = await testIntent(
        [
          {
            text: "Great meeting with TechCorp! They're interested in our enterprise plan, looking at a $50,000 annual contract.",
          },
        ],
        "create deal"
      );

      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("create_deal");
      const data = result.result.extractedData;
      expect(Number(data.value)).toBeGreaterThan(0);
      expect(String(data.associated_company || data.company).toLowerCase()).toContain("tech");
    }, 30000);

    it("should handle shorthand values (50k, 1M)", async () => {
      const result = await testIntent(
        [{ text: "Potential deal with BigCo worth around 25k" }],
        "add deal"
      );

      console.log("Extracted value:", result.result.extractedData.value);

      expect(result.result.intent).toBe("create_deal");
      const value = Number(result.result.extractedData.value);
      expect(value).toBeGreaterThanOrEqual(20000);
      expect(value).toBeLessThanOrEqual(30000);
    }, 30000);
  });

  describe("Create Task Intent", () => {
    it("should extract task with deadline", async () => {
      const result = await testIntent(
        [{ text: "Need to follow up with the Acme team next week" }],
        "create task"
      );

      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("create_task");
      const data = result.result.extractedData;
      expect(data.content || data.description).toBeDefined();
      expect(data.deadline_at || data.deadline).toBeDefined();
    }, 30000);

    it("should extract assignee from instruction", async () => {
      const result = await testIntent(
        [{ text: "Client wants a demo by Friday" }],
        "create task for John to schedule demo"
      );

      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("create_task");
      const data = result.result.extractedData;
      // Should have some mention of John
      const assignee = String(data.assignee || data.assignee_name || data.assignee_email || "");
      expect(assignee.toLowerCase()).toContain("john");
    }, 30000);
  });

  describe("Add Note Intent", () => {
    it("should recognize note intent with company target", async () => {
      const result = await testIntent(
        [
          { text: "Great call with Acme today!" },
          { text: "They want to move forward with Q1 rollout" },
        ],
        "save notes to Acme"
      );

      console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

      expect(result.result.intent).toBe("add_note");
      const data = result.result.extractedData;
      // Check various fields the AI might use for the parent record
      const parentFields = [
        "name",
        "company",
        "parent_name",
        "parent_object",
        "associated_company",
        "target_record",
        "record_name",
      ];
      const foundAcme = parentFields.some((field) => {
        const value = String(data[field] || "").toLowerCase();
        return value.includes("acme");
      });
      expect(foundAcme).toBe(true);
    }, 30000);
  });

  describe("Company Name Extraction Accuracy", () => {
    // Critical: Test that company names are extracted correctly
    const companyTestCases = [
      {
        text: "Just spoke with someone from Google",
        instruction: "create person",
        expectedCompany: "google",
      },
      {
        text: "Meeting with the Microsoft team went well",
        instruction: "create deal",
        expectedCompany: "microsoft",
      },
      {
        text: "Sarah from Amazon Web Services called",
        instruction: "add person",
        expectedCompany: "amazon",
      },
      {
        text: "Follow up with Stripe about the integration",
        instruction: "create task",
        expectedCompany: "stripe",
      },
      {
        text: "Add notes from our Salesforce meeting",
        instruction: "add note",
        expectedCompany: "salesforce",
      },
    ];

    for (const tc of companyTestCases) {
      it(`should extract company "${tc.expectedCompany}" from: "${tc.text.slice(0, 40)}..."`, async () => {
        const result = await testIntent([{ text: tc.text }], tc.instruction);

        console.log(`Expected: ${tc.expectedCompany}`);
        console.log("Extracted:", JSON.stringify(result.result.extractedData, null, 2));

        const data = result.result.extractedData;
        const companyFields = [
          "associated_company",
          "company",
          "name",
          "parent_name",
          "company_name",
        ];

        const extractedCompany = companyFields
          .map((f) => String(data[f] || ""))
          .find((v) => v.toLowerCase().includes(tc.expectedCompany));

        expect(extractedCompany).toBeDefined();
      }, 30000);
    }
  });

  describe("Edge Cases", () => {
    it("should handle empty messages with instruction only", async () => {
      const result = await testIntent([], "create a task to call John tomorrow");

      console.log("Empty messages result:", result.result.intent);
      expect(result.result.intent).toBe("create_task");
    }, 30000);

    it("should handle messages in non-English", async () => {
      const result = await testIntent(
        [{ text: "Reunión con Carlos de TechLatam. Email: carlos@techlatam.com" }],
        "crear persona"
      );

      console.log("Spanish result:", JSON.stringify(result.result.extractedData, null, 2));

      // Should still work - extract data regardless of language
      expect(result.result.intent).toBe("create_person");
      const data = result.result.extractedData;
      expect(String(data.name).toLowerCase()).toContain("carlos");
    }, 30000);

    it("should handle very long messages", async () => {
      const longText =
        "Meeting notes: " +
        "We discussed the project timeline and deliverables. ".repeat(20) +
        "Contact: test@example.com";

      const result = await testIntent([{ text: longText }], "create person");

      console.log("Long message result:", result.result.intent);
      expect(result.result).toBeDefined();
    }, 60000);
  });
});
