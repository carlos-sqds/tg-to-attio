/**
 * Company name matching utilities.
 *
 * Provides fuzzy matching for company names with support for:
 * - Suffix stripping (Inc, LLC, Corp, etc.)
 * - Sequential character matching
 * - Word-by-word matching
 */

/** Common company suffixes to strip for matching */
export const COMPANY_SUFFIXES = [
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
export function stripCompanySuffixes(name: string): string {
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
export function calculateWordSimilarity(a: string, b: string): number {
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
 * Count consecutive matching characters from the start of two strings.
 * Returns the ratio of matching chars to the input string's length.
 */
export function calculateSequentialMatch(input: string, result: string): number {
  const a = input.toLowerCase();
  const b = result.toLowerCase();

  let matchCount = 0;
  const minLen = Math.min(a.length, b.length);

  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      matchCount++;
    } else {
      break;
    }
  }

  // Return ratio relative to input length (what % of input matches from start)
  return input.length > 0 ? matchCount / input.length : 0;
}

/**
 * Check if input matches any word in the result (not just the first).
 * Returns the best match score across all result words.
 */
export function calculateBestWordMatch(
  input: string,
  result: string
): { score: number; word: string } {
  const inputLower = input.toLowerCase().trim();
  const resultWords = result.toLowerCase().split(/\s+/).filter(Boolean);

  if (inputLower.length === 0 || resultWords.length === 0) {
    return { score: 0, word: "" };
  }

  let bestScore = 0;
  let bestWord = "";

  for (const resultWord of resultWords) {
    // Exact word match
    if (inputLower === resultWord) {
      return { score: 1.0, word: resultWord };
    }

    // Sequential match on this word
    let matchCount = 0;
    const minLen = Math.min(inputLower.length, resultWord.length);
    for (let i = 0; i < minLen; i++) {
      if (inputLower[i] === resultWord[i]) {
        matchCount++;
      } else {
        break;
      }
    }

    const score = inputLower.length > 0 ? matchCount / inputLower.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestWord = resultWord;
    }
  }

  return { score: bestScore, word: bestWord };
}

export interface MatchConfidenceResult {
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
}

/**
 * Calculate confidence score for a match.
 */
export function calculateMatchConfidence(
  input: string,
  parsedName: string,
  parsedDomain: string | undefined,
  results: Array<{ name: string; extra?: string }>
): MatchConfidenceResult {
  if (results.length === 0) {
    return { confidence: "none", reason: "No results found" };
  }

  const firstResult = results[0];
  const inputLower = input.toLowerCase().trim();
  const parsedNameLower = parsedName.toLowerCase().trim();
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
  if (parsedDomain && firstResult.extra) {
    const inputDomain = parsedDomain.toLowerCase();
    const resultDomain = firstResult.extra.toLowerCase();
    if (inputDomain === resultDomain) {
      return { confidence: "high", reason: "Exact domain match" };
    }
    if (inputDomain.includes(resultDomain) || resultDomain.includes(inputDomain)) {
      return { confidence: "medium", reason: "Partial domain match" };
    }
  }

  // Sequential character matching
  const seqMatch = calculateSequentialMatch(inputStripped, resultStripped);
  if (seqMatch >= 0.9 && inputStripped.length >= 3) {
    return {
      confidence: capIfAmbiguous("high"),
      reason: `Sequential match (${Math.round(seqMatch * 100)}% of input)`,
    };
  }

  // Best word match - check if input matches ANY word in the result
  const bestWordMatch = calculateBestWordMatch(inputStripped, resultStripped);
  if (bestWordMatch.score >= 0.9 && inputStripped.length >= 3) {
    return {
      confidence: capIfAmbiguous("high"),
      reason: `Word match "${bestWordMatch.word}" (${Math.round(bestWordMatch.score * 100)}%)`,
    };
  }
  if (bestWordMatch.score >= 0.7 && inputStripped.length >= 3) {
    return {
      confidence: "medium",
      reason: `Partial word match "${bestWordMatch.word}" (${Math.round(bestWordMatch.score * 100)}%)`,
    };
  }

  // Core name is contained in result
  if (resultStripped.includes(inputStripped) && inputStripped.length >= 3) {
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

  // Result name is contained in input
  if (inputStripped.includes(resultStripped) && resultStripped.length >= 3) {
    return { confidence: "medium", reason: "Result name contained in input" };
  }

  // Fallback sequential match for shorter matches
  if (seqMatch >= 0.7 && inputStripped.length >= 3) {
    return {
      confidence: "medium",
      reason: `Sequential match (${Math.round(seqMatch * 100)}% of input)`,
    };
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
