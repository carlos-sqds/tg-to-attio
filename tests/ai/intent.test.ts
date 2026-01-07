import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";
import { analyzeIntentLocal } from "@/src/ai/intent";
import { mockSchema } from "./fixtures/mock-schema";
import { testCases, smokeTestCases, type AITestCase } from "./fixtures/test-cases";

// Load environment variables
beforeAll(() => {
  config({ path: ".env" });
});

function runTestCase(tc: AITestCase) {
  it(
    tc.name,
    async () => {
      const result = await analyzeIntentLocal({
        messages: tc.messages,
        instruction: tc.instruction,
        schema: mockSchema,
      });

      // Check intent
      expect(result.intent).toBe(tc.expectedIntent);

      // Check confidence is reasonable
      // Lower threshold when clarification is expected (uncertainty is appropriate)
      const minConfidence = tc.expectedClarification ? 0.3 : 0.5;
      expect(result.confidence).toBeGreaterThanOrEqual(minConfidence);

      // Check extracted data
      if (tc.expectedExtraction) {
        const extractedJson = JSON.stringify(result.extractedData).toLowerCase();

        for (const [_key, expectedValue] of Object.entries(tc.expectedExtraction)) {
          if (typeof expectedValue === "string") {
            // For strings, check if the value appears anywhere in extracted data
            expect(extractedJson).toContain(String(expectedValue).toLowerCase());
          } else if (typeof expectedValue === "number") {
            // For numbers, check if a similar number appears in extracted data
            const numberPattern = new RegExp(`${expectedValue}|${expectedValue / 1000}k`, "i");
            expect(extractedJson).toMatch(numberPattern);
          }
        }
      }

      // Check clarifications needed
      if (tc.expectedClarification) {
        expect(result.clarificationsNeeded.length).toBeGreaterThan(0);
        const clarification = result.clarificationsNeeded.find(
          (c) => c.field === tc.expectedClarification!.field
        );
        expect(clarification).toBeDefined();
        if (tc.expectedClarification.reason) {
          expect(clarification?.reason).toBe(tc.expectedClarification.reason);
        }
      }

      // Check missing required fields
      if (tc.expectedMissingRequired) {
        for (const field of tc.expectedMissingRequired) {
          expect(result.missingRequired).toContain(field);
        }
      }

      // Log for debugging
      console.log(`\n[${tc.name}]`);
      console.log(`Intent: ${result.intent} (confidence: ${result.confidence})`);
      console.log(`Extracted:`, result.extractedData);
      console.log(`Reasoning: ${result.reasoning}`);
      if (result.clarificationsNeeded.length > 0) {
        console.log(`Clarifications:`, result.clarificationsNeeded);
      }
      if (result.missingRequired.length > 0) {
        console.log(`Missing required:`, result.missingRequired);
      }
    },
    60000
  ); // 60s timeout for AI calls
}

describe("AI Intent Classification", () => {
  describe("Full Test Suite", () => {
    for (const tc of testCases) {
      runTestCase(tc);
    }
  });
});

describe("Smoke Tests (Quick)", () => {
  for (const tc of smokeTestCases) {
    runTestCase(tc);
  }
});

describe("Edge Cases", () => {
  it("should handle empty messages with instruction only", async () => {
    const result = await analyzeIntentLocal({
      messages: [],
      instruction: "create a task to call the client tomorrow",
      schema: mockSchema,
    });

    expect(result.intent).toBe("create_task");
    expect(result.extractedData).toBeDefined();
  }, 60000);

  it("should handle very long messages", async () => {
    const longText = "This is a test message. ".repeat(100);
    const result = await analyzeIntentLocal({
      messages: [
        {
          text: longText + " Contact: test@example.com",
          chatName: "Long Chat",
          date: Math.floor(Date.now() / 1000),
        },
      ],
      instruction: "create a person",
      schema: mockSchema,
    });

    expect(result.intent).toBe("create_person");
    expect(String(result.extractedData.email).toLowerCase()).toContain("test@example.com");
  }, 60000);

  it("should handle non-English content", async () => {
    const result = await analyzeIntentLocal({
      messages: [
        {
          text: "Hola, soy Carlos Martinez de TechLatam. Mi correo es carlos@techlatam.com",
          chatName: "Carlos Martinez",
          date: Math.floor(Date.now() / 1000),
          senderFirstName: "Carlos",
          senderLastName: "Martinez",
        },
      ],
      instruction: "create contact",
      schema: mockSchema,
    });

    expect(result.intent).toBe("create_person");
    expect(String(result.extractedData.email).toLowerCase()).toContain("carlos@techlatam.com");
  }, 60000);
});
