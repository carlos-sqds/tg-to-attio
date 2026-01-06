import { NextRequest, NextResponse } from "next/server";
import { searchRecords, parseCompanyInput } from "@/src/workflows/attio.actions";

interface MatchTestCase {
  input: string;
  expectedId?: string;
  expectedName?: string;
}

interface MatchResult {
  input: string;
  parsed: { name: string; domain?: string };
  searchQuery: string;
  results: Array<{ id: string; name: string; extra?: string }>;
  bestMatch: { id: string; name: string; extra?: string } | null;
  confidence: "high" | "medium" | "low" | "none";
  matchReason: string;
}

/**
 * Calculate confidence score for a match.
 */
function calculateMatchConfidence(
  input: string,
  parsed: { name: string; domain?: string },
  results: Array<{ id: string; name: string; extra?: string }>
): { confidence: "high" | "medium" | "low" | "none"; reason: string } {
  if (results.length === 0) {
    return { confidence: "none", reason: "No results found" };
  }

  const firstResult = results[0];
  const inputLower = input.toLowerCase().trim();
  const parsedNameLower = parsed.name.toLowerCase().trim();
  const resultNameLower = firstResult.name.toLowerCase().trim();

  // Exact match
  if (resultNameLower === inputLower || resultNameLower === parsedNameLower) {
    return { confidence: "high", reason: "Exact name match" };
  }

  // Domain match
  if (parsed.domain && firstResult.extra) {
    const inputDomain = parsed.domain.toLowerCase();
    const resultDomain = firstResult.extra.toLowerCase();
    if (inputDomain === resultDomain) {
      return { confidence: "high", reason: "Exact domain match" };
    }
    if (inputDomain.includes(resultDomain) || resultDomain.includes(inputDomain)) {
      return { confidence: "medium", reason: "Partial domain match" };
    }
  }

  // Name contains check
  if (resultNameLower.includes(parsedNameLower) || parsedNameLower.includes(resultNameLower)) {
    // Check if it's a significant portion
    const overlapRatio =
      Math.min(parsedNameLower.length, resultNameLower.length) /
      Math.max(parsedNameLower.length, resultNameLower.length);
    if (overlapRatio > 0.7) {
      return { confidence: "medium", reason: `Name overlap (${Math.round(overlapRatio * 100)}%)` };
    }
    return { confidence: "low", reason: `Weak name overlap (${Math.round(overlapRatio * 100)}%)` };
  }

  // Multiple results - ambiguous
  if (results.length > 1) {
    return { confidence: "low", reason: `Ambiguous: ${results.length} results, no clear match` };
  }

  return { confidence: "low", reason: "Weak match - first result taken" };
}

/**
 * Test endpoint for company matching logic.
 *
 * GET /api/test/match?input=Acme%20Inc
 * POST /api/test/match { input: "Acme Inc" }
 * POST /api/test/match { inputs: ["Acme Inc", "acme.com", "Acme Corporation"] }
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get("input");
  const object = searchParams.get("object") || "companies";

  if (!input) {
    return NextResponse.json({ error: "Missing required parameter: input" }, { status: 400 });
  }

  try {
    const result = await testMatch(input, object);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { input, inputs, object = "companies", testCases } = body;

    // Handle test cases with expected values
    if (testCases && Array.isArray(testCases)) {
      const results = await runTestCases(testCases, object);
      return NextResponse.json(results);
    }

    // Handle multiple inputs
    if (inputs && Array.isArray(inputs)) {
      const results = await Promise.all(inputs.map((inp: string) => testMatch(inp, object)));
      return NextResponse.json({
        inputCount: inputs.length,
        results,
        summary: {
          high: results.filter((r) => r.confidence === "high").length,
          medium: results.filter((r) => r.confidence === "medium").length,
          low: results.filter((r) => r.confidence === "low").length,
          none: results.filter((r) => r.confidence === "none").length,
        },
      });
    }

    // Handle single input
    if (input) {
      const result = await testMatch(input, object);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Missing required field: input, inputs, or testCases" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function testMatch(input: string, object: string): Promise<MatchResult> {
  const parsed = object === "companies" ? parseCompanyInput(input) : { name: input };
  const searchQuery = parsed.name;

  const results = await searchRecords(object, searchQuery);
  const { confidence, reason } = calculateMatchConfidence(input, parsed, results);

  return {
    input,
    parsed,
    searchQuery,
    results,
    bestMatch: results.length > 0 ? results[0] : null,
    confidence,
    matchReason: reason,
  };
}

async function runTestCases(
  testCases: MatchTestCase[],
  object: string
): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    input: string;
    expected: { id?: string; name?: string };
    actual: MatchResult;
    passed: boolean;
    failReason?: string;
  }>;
}> {
  const results = await Promise.all(
    testCases.map(async (tc) => {
      const actual = await testMatch(tc.input, object);
      let passed = true;
      let failReason: string | undefined;

      if (tc.expectedId && actual.bestMatch?.id !== tc.expectedId) {
        passed = false;
        failReason = `Expected ID ${tc.expectedId}, got ${actual.bestMatch?.id || "none"}`;
      }

      if (tc.expectedName && actual.bestMatch?.name !== tc.expectedName) {
        passed = false;
        failReason = `Expected name "${tc.expectedName}", got "${actual.bestMatch?.name || "none"}"`;
      }

      return {
        input: tc.input,
        expected: { id: tc.expectedId, name: tc.expectedName },
        actual,
        passed,
        failReason,
      };
    })
  );

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
