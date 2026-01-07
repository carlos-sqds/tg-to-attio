/**
 * Unit tests for target type resolution.
 *
 * Tests the flow: "add to p2p" → user selects "Company" → search for companies
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTargetName,
  isTargetTypeClarification,
  isValidTargetType,
  resolveTargetType,
} from "@/src/lib/ai/target-resolution";
import type { SuggestedAction } from "@/src/services/attio/schema-types";

// Mock the search function
vi.mock("@/src/workflows/attio-actions/search.action", () => ({
  searchRecords: vi.fn(),
}));

import { searchRecords } from "@/src/workflows/attio-actions/search.action";
const mockSearchRecords = vi.mocked(searchRecords);

function createAction(overrides: Partial<SuggestedAction> = {}): SuggestedAction {
  return {
    intent: "add_note",
    confidence: 0.7,
    targetObject: "companies",
    extractedData: {},
    missingRequired: [],
    clarificationsNeeded: [
      {
        field: "target_type",
        question: "Is 'p2p' a list, company, or person?",
        options: ["List", "Company", "Person"],
        reason: "ambiguous",
      },
    ],
    reasoning: "Ambiguous target",
    noteTitle: "Add to p2p",
    ...overrides,
  };
}

describe("extractTargetName", () => {
  it("extracts target from 'add to p2p'", () => {
    expect(extractTargetName("add to p2p")).toBe("p2p");
  });

  it("extracts target from 'add to acme'", () => {
    expect(extractTargetName("add to acme")).toBe("acme");
  });

  it("extracts target from 'ADD TO P2P'", () => {
    expect(extractTargetName("ADD TO P2P")).toBe("P2P");
  });

  it("extracts target from 'add to iron - important notes'", () => {
    expect(extractTargetName("add to iron - important notes")).toBe("iron");
  });

  it("returns null for non-matching instructions", () => {
    expect(extractTargetName("create company TechCorp")).toBeNull();
    expect(extractTargetName("add company")).toBeNull();
  });
});

describe("isTargetTypeClarification", () => {
  it("returns true for target_type field", () => {
    expect(isTargetTypeClarification("target_type")).toBe(true);
  });

  it("returns false for other fields", () => {
    expect(isTargetTypeClarification("company")).toBe(false);
    expect(isTargetTypeClarification("company_name")).toBe(false);
  });
});

describe("isValidTargetType", () => {
  it("returns true for valid target types", () => {
    expect(isValidTargetType("Company")).toBe(true);
    expect(isValidTargetType("Person")).toBe(true);
    expect(isValidTargetType("List")).toBe(true);
    expect(isValidTargetType("company")).toBe(true);
  });

  it("returns false for invalid target types", () => {
    expect(isValidTargetType("Deal")).toBe(false);
    expect(isValidTargetType("Task")).toBe(false);
    expect(isValidTargetType("Unknown")).toBe(false);
  });
});

describe("resolveTargetType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches for companies when user selects Company", async () => {
    mockSearchRecords.mockResolvedValue([
      { id: "1", name: "P2P Staking", extra: "p2p.com" },
      { id: "2", name: "P2P Labs", extra: "p2plabs.io" },
    ]);

    const action = createAction();
    const result = await resolveTargetType(action, "Company", "add to p2p");

    expect(mockSearchRecords).toHaveBeenCalledWith("companies", "p2p");
    expect(result.intent).toBe("add_note");
    expect(result.targetObject).toBe("companies");
    expect(result.clarificationsNeeded[0].field).toBe("company_selection");
    expect(result.clarificationsNeeded[0].options).toEqual(["P2P Staking", "P2P Labs"]);
    expect(result.clarificationsNeeded[0].question).toContain("Which company");
  });

  it("asks for company name when no matches found", async () => {
    mockSearchRecords.mockResolvedValue([]);

    const action = createAction();
    const result = await resolveTargetType(action, "Company", "add to xyz");

    expect(mockSearchRecords).toHaveBeenCalledWith("companies", "xyz");
    expect(result.clarificationsNeeded[0].field).toBe("company_name");
    expect(result.clarificationsNeeded[0].question).toContain("No company found");
    expect(result.clarificationsNeeded[0].question).toContain("xyz");
    expect(result.clarificationsNeeded[0].reason).toBe("not_found");
  });

  it("searches for people when user selects Person", async () => {
    mockSearchRecords.mockResolvedValue([{ id: "1", name: "John P2P" }]);

    const action = createAction();
    const result = await resolveTargetType(action, "Person", "add to p2p");

    expect(mockSearchRecords).toHaveBeenCalledWith("people", "p2p");
    expect(result.targetObject).toBe("people");
    expect(result.clarificationsNeeded[0].field).toBe("person_selection");
  });

  it("searches for lists when user selects List", async () => {
    mockSearchRecords.mockResolvedValue([{ id: "1", name: "P2P Partners" }]);

    const action = createAction();
    const result = await resolveTargetType(action, "List", "add to p2p");

    expect(mockSearchRecords).toHaveBeenCalledWith("lists", "p2p");
    expect(result.intent).toBe("add_to_list");
    expect(result.targetObject).toBe("lists");
    expect(result.clarificationsNeeded[0].field).toBe("list_selection");
  });

  it("removes target_type clarification after resolution", async () => {
    mockSearchRecords.mockResolvedValue([{ id: "1", name: "P2P Staking" }]);

    const action = createAction({
      clarificationsNeeded: [
        {
          field: "target_type",
          question: "Is 'p2p' a list, company, or person?",
          options: ["List", "Company", "Person"],
          reason: "ambiguous",
        },
        {
          field: "other_field",
          question: "Some other question?",
          reason: "missing",
        },
      ],
    });

    const result = await resolveTargetType(action, "Company", "add to p2p");

    // Should not have target_type clarification anymore
    expect(result.clarificationsNeeded.find((c) => c.field === "target_type")).toBeUndefined();
    // Should still have other clarification
    expect(result.clarificationsNeeded.find((c) => c.field === "other_field")).toBeDefined();
  });

  it("limits options to 5 companies", async () => {
    mockSearchRecords.mockResolvedValue([
      { id: "1", name: "Company 1" },
      { id: "2", name: "Company 2" },
      { id: "3", name: "Company 3" },
      { id: "4", name: "Company 4" },
      { id: "5", name: "Company 5" },
      { id: "6", name: "Company 6" },
      { id: "7", name: "Company 7" },
    ]);

    const action = createAction();
    const result = await resolveTargetType(action, "Company", "add to test");

    expect(result.clarificationsNeeded[0].options).toHaveLength(5);
  });

  it("stores search results in extractedData", async () => {
    const searchResults = [{ id: "1", name: "P2P Staking", extra: "p2p.com" }];
    mockSearchRecords.mockResolvedValue(searchResults);

    const action = createAction();
    const result = await resolveTargetType(action, "Company", "add to p2p");

    expect(result.extractedData.search_results).toEqual(searchResults);
    expect(result.extractedData.target_type).toBe("company");
  });

  it("returns original action if target name cannot be extracted", async () => {
    const action = createAction();
    const result = await resolveTargetType(action, "Company", "create company");

    expect(mockSearchRecords).not.toHaveBeenCalled();
    expect(result).toEqual(action);
  });
});
