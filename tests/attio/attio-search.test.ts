import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCompanies } from "@/workflows/steps/attio";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Attio Search (Conversation Workflow)", () => {
  beforeEach(() => {
    vi.stubEnv("ATTIO_API_KEY", "test-api-key");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("searchCompanies", () => {
    it("uses the search endpoint with correct request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await searchCompanies("TechCorp");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/objects/records/search");

      const callBody = JSON.parse(options.body);
      expect(callBody).toEqual({
        query: "TechCorp",
        objects: ["companies"],
        request_as: { type: "workspace" },
        limit: 10,
      });
    });

    it("searches for companies and returns formatted results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "company-1" },
                primary_attribute: { value: "Acme Corp" },
              },
              {
                id: { record_id: "company-2" },
                primary_attribute: { value: "Acme Inc" },
              },
            ],
          }),
      });

      const results = await searchCompanies("Acme");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("company-1");
      expect(results[0].name).toBe("Acme Corp");
      expect(results[1].id).toBe("company-2");
      expect(results[1].name).toBe("Acme Inc");
    });

    it("handles companies with missing primary_attribute", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "company-1" },
              },
            ],
          }),
      });

      const results = await searchCompanies("Test");

      expect(results[0].name).toBe("Unnamed Company");
    });

    it("calls the correct Attio API endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await searchCompanies("Test");

      expect(mockFetch.mock.calls[0][0]).toBe("https://api.attio.com/v2/objects/records/search");
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("includes authorization header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await searchCompanies("Test");

      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer test-api-key");
    });

    it("limits results to 10", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await searchCompanies("Test");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.limit).toBe(10);
    });

    it("throws error when API key is missing", async () => {
      vi.stubEnv("ATTIO_API_KEY", "");

      await expect(searchCompanies("Test")).rejects.toThrow("ATTIO_API_KEY not configured");
    });

    it("throws error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid API key"),
      });

      await expect(searchCompanies("Test")).rejects.toThrow("Attio API error: 401");
    });
  });
});
