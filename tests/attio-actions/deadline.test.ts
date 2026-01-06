import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseDeadline, toAttioDateFormat, parseCompanyInput } from "@/src/workflows/attio.actions";

describe("toAttioDateFormat", () => {
  it("converts to nanosecond precision (9 decimal places)", () => {
    const date = new Date("2025-12-10T09:00:00.000Z");
    const result = toAttioDateFormat(date);
    expect(result).toBe("2025-12-10T09:00:00.000000000Z");
  });

  it("preserves milliseconds in conversion", () => {
    const date = new Date("2025-12-10T09:00:00.123Z");
    const result = toAttioDateFormat(date);
    expect(result).toBe("2025-12-10T09:00:00.123000000Z");
  });
});

describe("parseDeadline", () => {
  beforeEach(() => {
    // Mock date to Friday, December 5, 2025 at noon UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("null/invalid inputs", () => {
    it("returns null for null input", () => {
      expect(parseDeadline(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(parseDeadline(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseDeadline("")).toBeNull();
    });

    it('returns null for "undefined" string', () => {
      expect(parseDeadline("undefined")).toBeNull();
    });

    it('returns null for "null" string', () => {
      expect(parseDeadline("null")).toBeNull();
    });

    it("returns null for unrecognized text", () => {
      expect(parseDeadline("random text")).toBeNull();
      expect(parseDeadline("sometime soon")).toBeNull();
    });
  });

  describe("relative dates - tomorrow", () => {
    it('parses "tomorrow" correctly', () => {
      const result = parseDeadline("tomorrow");
      expect(result).toContain("2025-12-06"); // Saturday
      // Time may vary by timezone, just check it's set to a reasonable hour
      expect(result).toMatch(/T\d{2}:00:00\.000000000Z$/);
    });

    it('parses "Tomorrow" (capitalized) correctly', () => {
      const result = parseDeadline("Tomorrow");
      expect(result).toContain("2025-12-06");
    });
  });

  describe("relative dates - next week", () => {
    it('parses "next week" correctly (+7 days)', () => {
      const result = parseDeadline("next week");
      expect(result).toContain("2025-12-12"); // Friday + 7 = Friday
    });

    it('parses "1 week" correctly', () => {
      const result = parseDeadline("1 week");
      expect(result).toContain("2025-12-12");
    });

    it('parses "a week" correctly', () => {
      const result = parseDeadline("a week");
      expect(result).toContain("2025-12-12");
    });
  });

  describe("weekday calculations from Friday Dec 5", () => {
    // Dec 5, 2025 is Friday (day 5)
    // Dec 6 = Sat, Dec 7 = Sun, Dec 8 = Mon, Dec 9 = Tue, Dec 10 = Wed, Dec 11 = Thu, Dec 12 = Fri

    it('parses "wednesday" correctly - should be Dec 10', () => {
      const result = parseDeadline("wednesday");
      expect(result).toContain("2025-12-10");
    });

    it('parses "next wednesday" correctly - should be Dec 10', () => {
      const result = parseDeadline("next wednesday");
      expect(result).toContain("2025-12-10");
    });

    it('parses "monday" correctly - should be Dec 8', () => {
      const result = parseDeadline("monday");
      expect(result).toContain("2025-12-08");
    });

    it('parses "tuesday" correctly - should be Dec 9', () => {
      const result = parseDeadline("tuesday");
      expect(result).toContain("2025-12-09");
    });

    it('parses "thursday" correctly - should be Dec 11', () => {
      const result = parseDeadline("thursday");
      expect(result).toContain("2025-12-11");
    });

    it('parses "friday" correctly - should be Dec 12 (next Friday, not today)', () => {
      const result = parseDeadline("friday");
      expect(result).toContain("2025-12-12");
    });

    it('parses "saturday" correctly - should be Dec 6', () => {
      const result = parseDeadline("saturday");
      expect(result).toContain("2025-12-06");
    });

    it('parses "sunday" correctly - should be Dec 7', () => {
      const result = parseDeadline("sunday");
      expect(result).toContain("2025-12-07");
    });
  });

  describe("X days format", () => {
    it('parses "3 days" correctly', () => {
      const result = parseDeadline("3 days");
      expect(result).toContain("2025-12-08"); // Dec 5 + 3 = Dec 8
    });

    it('parses "in 5 days" correctly', () => {
      const result = parseDeadline("in 5 days");
      expect(result).toContain("2025-12-10"); // Dec 5 + 5 = Dec 10
    });

    it('parses "1 day" correctly', () => {
      const result = parseDeadline("1 day");
      expect(result).toContain("2025-12-06");
    });
  });

  describe("end of week", () => {
    it('parses "end of week" correctly - should be Friday', () => {
      const result = parseDeadline("end of week");
      // From Friday, next Friday is Dec 12 (current day doesn't count)
      expect(result).toContain("2025-12-12");
      // Time set to end of day (may vary by timezone)
      expect(result).toMatch(/T\d{2}:00:00/);
    });

    it('parses "eow" correctly', () => {
      const result = parseDeadline("eow");
      expect(result).toContain("2025-12-12");
    });
  });

  describe("ISO date format", () => {
    it('parses "2025-12-15" correctly', () => {
      const result = parseDeadline("2025-12-15");
      expect(result).toContain("2025-12-15");
      expect(result).toMatch(/\.000000000Z$/);
    });

    it('parses ISO datetime "2025-12-15T14:30:00Z" correctly', () => {
      const result = parseDeadline("2025-12-15T14:30:00Z");
      expect(result).toContain("2025-12-15");
      expect(result).toContain("14:30:00");
    });

    it("does not parse invalid date format", () => {
      expect(parseDeadline("12-15-2025")).toBeNull(); // Wrong format
      expect(parseDeadline("Dec 15")).toBeNull();
    });
  });

  describe("case insensitivity", () => {
    it("handles uppercase", () => {
      expect(parseDeadline("TOMORROW")).toContain("2025-12-06");
      expect(parseDeadline("WEDNESDAY")).toContain("2025-12-10");
    });

    it("handles mixed case", () => {
      expect(parseDeadline("Next Wednesday")).toContain("2025-12-10");
      expect(parseDeadline("ToMoRrOw")).toContain("2025-12-06");
    });
  });
});

describe("parseDeadline from different starting days", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates wednesday correctly from Monday Dec 8", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-08T12:00:00Z")); // Monday

    const result = parseDeadline("wednesday");
    expect(result).toContain("2025-12-10"); // Same week Wednesday
  });

  it("calculates wednesday correctly from Wednesday Dec 10", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-10T12:00:00Z")); // Wednesday

    const result = parseDeadline("wednesday");
    // Should be NEXT Wednesday since today is Wednesday
    expect(result).toContain("2025-12-17");
  });

  it("calculates wednesday correctly from Thursday Dec 11", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-11T12:00:00Z")); // Thursday

    const result = parseDeadline("wednesday");
    expect(result).toContain("2025-12-17"); // Next Wednesday
  });
});

describe("parseDeadline weeks format", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-05T12:00:00Z")); // Friday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses "2 weeks" correctly', () => {
    const result = parseDeadline("2 weeks");
    expect(result).toContain("2025-12-19"); // Dec 5 + 14 = Dec 19
  });

  it('parses "in 2 weeks" correctly', () => {
    const result = parseDeadline("in 2 weeks");
    expect(result).toContain("2025-12-19");
  });

  it('parses "two weeks" correctly', () => {
    const result = parseDeadline("two weeks");
    expect(result).toContain("2025-12-19");
  });

  it('parses "in two weeks" correctly', () => {
    const result = parseDeadline("in two weeks");
    expect(result).toContain("2025-12-19");
  });

  it('parses "3 weeks" correctly', () => {
    const result = parseDeadline("3 weeks");
    expect(result).toContain("2025-12-26"); // Dec 5 + 21 = Dec 26
  });

  it('parses "three weeks" correctly', () => {
    const result = parseDeadline("three weeks");
    expect(result).toContain("2025-12-26");
  });

  it('parses "1 week" correctly (same as next week)', () => {
    const result = parseDeadline("1 week");
    expect(result).toContain("2025-12-12"); // Dec 5 + 7 = Dec 12
  });

  it('parses "one week" correctly', () => {
    const result = parseDeadline("one week");
    expect(result).toContain("2025-12-12");
  });

  it('parses "four weeks" correctly', () => {
    const result = parseDeadline("four weeks");
    expect(result).toContain("2026-01-02"); // Dec 5 + 28 = Jan 2
  });
});

describe("parseCompanyInput", () => {
  it('extracts name and domain from "Company from domain.com"', () => {
    const result = parseCompanyInput("Noah from Noah.com");
    expect(result.name).toBe("Noah");
    expect(result.domain).toBe("noah.com");
  });

  it('handles "Company from https://domain.com" pattern', () => {
    const result = parseCompanyInput("TechCorp from techcorp.io");
    expect(result.name).toBe("TechCorp");
    expect(result.domain).toBe("techcorp.io");
  });

  it('extracts name and domain from "Company (domain.com)"', () => {
    const result = parseCompanyInput("Acme Inc (acme.com)");
    expect(result.name).toBe("Acme Inc");
    expect(result.domain).toBe("acme.com");
  });

  it("extracts company name from just a domain", () => {
    const result = parseCompanyInput("stripe.com");
    expect(result.name).toBe("Stripe");
    expect(result.domain).toBe("stripe.com");
  });

  it("handles URL format with https", () => {
    const result = parseCompanyInput("https://shopify.com");
    expect(result.name).toBe("Shopify");
    expect(result.domain).toBe("shopify.com");
  });

  it("handles URL with www", () => {
    const result = parseCompanyInput("www.google.com");
    expect(result.name).toBe("Google");
    expect(result.domain).toBe("google.com");
  });

  it("returns just name for plain company names", () => {
    const result = parseCompanyInput("Microsoft");
    expect(result.name).toBe("Microsoft");
    expect(result.domain).toBeUndefined();
  });

  it("trims whitespace", () => {
    const result = parseCompanyInput("  Apple  ");
    expect(result.name).toBe("Apple");
  });
});
