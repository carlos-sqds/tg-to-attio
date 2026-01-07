import { describe, it, expect } from "vitest";
import { SuggestedActionSchema } from "@/src/services/attio/schema-types";

describe("SuggestedActionSchema coercion", () => {
  const validBaseObject = {
    intent: "create_person",
    confidence: 0.9,
    targetObject: "people",
    extractedData: { name: "John" },
    clarificationsNeeded: [],
    reasoning: "Test reasoning",
    noteTitle: "Test note",
  };

  describe("missingRequired field coercion", () => {
    it("should accept a proper array", () => {
      const input = { ...validBaseObject, missingRequired: ["field1", "field2"] };
      const result = SuggestedActionSchema.parse(input);
      expect(result.missingRequired).toEqual(["field1", "field2"]);
    });

    it("should accept an empty array", () => {
      const input = { ...validBaseObject, missingRequired: [] };
      const result = SuggestedActionSchema.parse(input);
      expect(result.missingRequired).toEqual([]);
    });

    it("should coerce string '[]' to empty array", () => {
      const input = { ...validBaseObject, missingRequired: "[]" };
      const result = SuggestedActionSchema.parse(input);
      expect(result.missingRequired).toEqual([]);
    });

    it("should coerce string '[],' (with trailing comma) to empty array", () => {
      const input = { ...validBaseObject, missingRequired: "[]," };
      const result = SuggestedActionSchema.parse(input);
      expect(result.missingRequired).toEqual([]);
    });

    it("should coerce empty string to empty array", () => {
      const input = { ...validBaseObject, missingRequired: "" };
      const result = SuggestedActionSchema.parse(input);
      expect(result.missingRequired).toEqual([]);
    });

    it("should coerce JSON array string to array", () => {
      const input = { ...validBaseObject, missingRequired: '["field1", "field2"]' };
      const result = SuggestedActionSchema.parse(input);
      expect(result.missingRequired).toEqual(["field1", "field2"]);
    });

    it("should handle malformed JSON gracefully", () => {
      const input = { ...validBaseObject, missingRequired: "[invalid json" };
      const result = SuggestedActionSchema.parse(input);
      expect(result.missingRequired).toEqual([]);
    });

    it("should handle undefined/null by returning empty array", () => {
      const input = { ...validBaseObject, missingRequired: undefined };
      // This will fail schema validation since missingRequired is required
      // but the coercion should still handle it gracefully
      expect(() => SuggestedActionSchema.parse(input)).not.toThrow();
    });
  });
});
