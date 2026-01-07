/**
 * Unit tests for "add to X" pattern enforcement.
 *
 * The AI prompt tells it to ask for clarification when instruction is "add to <name>",
 * but LLMs are non-deterministic. This test ensures code-level enforcement works
 * as a safety net.
 */

import { describe, it, expect } from "vitest";
import { enforceAddToPattern } from "@/src/lib/ai/add-to-pattern";
import type { SuggestedAction, Clarification } from "@/src/services/attio/schema-types";

function createAction(overrides: Partial<SuggestedAction>): SuggestedAction {
  return {
    intent: "create_company",
    confidence: 0.8,
    targetObject: "companies",
    extractedData: { name: "test" },
    missingRequired: [],
    clarificationsNeeded: [],
    reasoning: "Test action",
    noteTitle: "Test note",
    ...overrides,
  };
}

describe("enforceAddToPattern", () => {
  describe("when instruction matches 'add to X' pattern", () => {
    it("should add clarification if AI returned create_company without asking", () => {
      const action = createAction({
        intent: "create_company",
        extractedData: { name: "p2p" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "add to p2p");

      expect(result.intent).toBe("add_note");
      expect(result.clarificationsNeeded.length).toBeGreaterThan(0);
      expect(result.clarificationsNeeded[0].field).toBe("target_type");
      expect(result.clarificationsNeeded[0].reason).toBe("ambiguous");
      expect(result.clarificationsNeeded[0].options).toEqual(["List", "Company", "Person"]);
    });

    it("should add clarification if AI returned create_person without asking", () => {
      const action = createAction({
        intent: "create_person",
        targetObject: "people",
        extractedData: { name: "p2p" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "add to acme");

      expect(result.intent).toBe("add_note");
      expect(result.clarificationsNeeded[0].field).toBe("target_type");
      expect(result.clarificationsNeeded[0].options).toEqual(["List", "Company", "Person"]);
    });

    it("should preserve existing clarification if AI already asked correctly", () => {
      const existingClarification: Clarification = {
        field: "target_type",
        question: "Is 'p2p' a list, company, or person?",
        options: ["List", "Company", "Person"],
        reason: "ambiguous",
      };

      const action = createAction({
        intent: "add_note",
        extractedData: {},
        clarificationsNeeded: [existingClarification],
      });

      const result = enforceAddToPattern(action, "add to p2p");

      expect(result.intent).toBe("add_note");
      expect(result.clarificationsNeeded).toEqual([existingClarification]);
    });

    it("should handle 'add to X' with extra context", () => {
      const action = createAction({
        intent: "create_company",
        extractedData: { name: "iron" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "add to iron - important notes");

      expect(result.intent).toBe("add_note");
      expect(result.clarificationsNeeded[0].field).toBe("target_type");
    });

    it("should handle case insensitivity", () => {
      const action = createAction({
        intent: "create_company",
        extractedData: { name: "P2P" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "ADD TO P2P");

      expect(result.intent).toBe("add_note");
      expect(result.clarificationsNeeded[0].field).toBe("target_type");
    });
  });

  describe("when instruction does NOT match 'add to X' pattern", () => {
    it("should not modify action for 'create company'", () => {
      const action = createAction({
        intent: "create_company",
        extractedData: { name: "TechCorp" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "create company TechCorp");

      expect(result.intent).toBe("create_company");
      expect(result.clarificationsNeeded.length).toBe(0);
    });

    it("should not modify action for 'add note to company'", () => {
      const action = createAction({
        intent: "add_note",
        extractedData: { parent_name: "Acme" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "add note to Acme company");

      expect(result.intent).toBe("add_note");
      expect(result.clarificationsNeeded.length).toBe(0);
    });

    it("should not modify action for 'create task for'", () => {
      const action = createAction({
        intent: "create_task",
        extractedData: { content: "Call client" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "create task for John");

      expect(result.intent).toBe("create_task");
    });
  });

  describe("edge cases", () => {
    it("should handle empty instruction gracefully", () => {
      const action = createAction({
        intent: "create_company",
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "");

      expect(result).toEqual(action);
    });

    it("should not match 'add' without 'to'", () => {
      const action = createAction({
        intent: "create_company",
        extractedData: { name: "NewCo" },
        clarificationsNeeded: [],
      });

      const result = enforceAddToPattern(action, "add company NewCo");

      expect(result.intent).toBe("create_company");
    });
  });
});
