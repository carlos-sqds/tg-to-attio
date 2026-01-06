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

// Common company suffixes to strip for matching
const COMPANY_SUFFIXES = [
  "inc",
  "inc.",
  "incorporated",
  "llc",
  "llc.",
  "ltd",
  "ltd.",
  "limited",
  "corp",
  "corp.",
  "corporation",
  "co",
  "co.",
  "company",
  "labs",
  "lab",
  "technologies",
  "technology",
  "tech",
  "solutions",
  "services",
  "group",
  "holdings",
  "partners",
  "ventures",
  "capital",
  "gmbh",
  "ag",
  "sa",
  "pty",
  "plc",
];

/**
 * Strip common suffixes from company name for better matching.
 */
function stripCompanySuffixes(name: string): string {
  let result = name.toLowerCase().trim();
  for (const suffix of COMPANY_SUFFIXES) {
    // Match suffix at end of string, possibly with punctuation
    const pattern = new RegExp(`\\s+${suffix.replace(".", "\\.")}[.]?$`, "i");
    result = result.replace(pattern, "").trim();
  }
  return result;
}

/**
 * Calculate word-based similarity between two strings.
 */
function calculateWordSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  // Count matching words
  const matchingWords = wordsA.filter((word) =>
    wordsB.some((w) => w === word || w.includes(word) || word.includes(w))
  ).length;

  return matchingWords / Math.max(wordsA.length, wordsB.length);
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

  // Strip suffixes for comparison
  const inputStripped = stripCompanySuffixes(parsedNameLower);
  const resultStripped = stripCompanySuffixes(resultNameLower);

  // Ambiguity check: if there are many results, cap confidence at medium
  // unless it's an exact match or domain match
  const isAmbiguous = results.length > 3;

  // Helper to apply ambiguity cap
  const capIfAmbiguous = (conf: "high" | "medium" | "low"): "high" | "medium" | "low" => {
    if (isAmbiguous && conf === "high") return "medium";
    return conf;
  };

  // Exact match (with or without suffixes) - not capped, user searched for exactly this
  if (resultNameLower === inputLower || resultNameLower === parsedNameLower) {
    return { confidence: "high", reason: "Exact name match" };
  }

  // Exact match after stripping suffixes - not capped for true suffix stripping
  if (inputStripped === resultStripped && inputStripped.length > 2) {
    // Only keep high confidence if input was longer (had suffix stripped)
    // If input is same length as stripped, it's just generic and should be capped
    const hadSuffixStripped = parsedNameLower.length > inputStripped.length;
    if (hadSuffixStripped) {
      return { confidence: "high", reason: "Exact match (ignoring suffixes)" };
    }
    return {
      confidence: capIfAmbiguous("high"),
      reason: isAmbiguous ? "Match found but ambiguous results" : "Exact match (ignoring suffixes)",
    };
  }

  // Domain match - highest priority, not capped
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

  // Core name is contained in result (e.g., "Squads" in "Squads Labs")
  if (resultStripped.includes(inputStripped) && inputStripped.length >= 3) {
    // Input is the primary name, result has additional words
    const extraWords = resultStripped.replace(inputStripped, "").trim();
    if (extraWords.length < inputStripped.length) {
      return {
        confidence: capIfAmbiguous("high"),
        reason: isAmbiguous
          ? "Core name match but ambiguous results"
          : "Core name match with qualifier",
      };
    }
    return { confidence: "medium", reason: "Name contained in result" };
  }

  // Result name is contained in input (e.g., "Acme Corp" when searching "Acme")
  if (inputStripped.includes(resultStripped) && resultStripped.length >= 3) {
    return { confidence: "medium", reason: "Result name contained in input" };
  }

  // Word-based similarity
  const wordSim = calculateWordSimilarity(inputStripped, resultStripped);
  if (wordSim >= 0.8) {
    return {
      confidence: capIfAmbiguous("high"),
      reason: `Word match (${Math.round(wordSim * 100)}%)`,
    };
  }
  if (wordSim >= 0.5) {
    return { confidence: "medium", reason: `Partial word match (${Math.round(wordSim * 100)}%)` };
  }

  // Character-based overlap ratio
  const overlapRatio =
    Math.min(inputStripped.length, resultStripped.length) /
    Math.max(inputStripped.length, resultStripped.length);

  if (overlapRatio > 0.8) {
    return { confidence: "medium", reason: `Name overlap (${Math.round(overlapRatio * 100)}%)` };
  }

  // Multiple results - check if first is clearly better
  if (results.length > 1) {
    // Check if first result's stripped name starts with input
    if (resultStripped.startsWith(inputStripped) && inputStripped.length >= 3) {
      return { confidence: "medium", reason: "Best match among multiple results" };
    }
    return { confidence: "low", reason: `Ambiguous: ${results.length} results, no clear match` };
  }

  if (overlapRatio > 0.5) {
    return { confidence: "low", reason: `Weak name overlap (${Math.round(overlapRatio * 100)}%)` };
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

  // Strip suffixes from search query to find the core company name
  const strippedName = stripCompanySuffixes(parsed.name);
  const searchQuery = strippedName.length >= 2 ? strippedName : parsed.name;

  let results = await searchRecords(object, searchQuery);

  // If no results with stripped name, try original
  if (results.length === 0 && searchQuery !== parsed.name) {
    results = await searchRecords(object, parsed.name);
  }

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
