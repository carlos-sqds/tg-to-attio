import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createPerson,
  createCompany,
  createDeal,
  createTask,
  createNote,
  addToList,
  searchRecords,
  executeActionWithNote,
  clearDealStagesCache,
  type CreatePersonInput,
  type CreateCompanyInput,
  type CreateDealInput,
  type CreateTaskInput,
  type CreateNoteInput,
} from "@/workflows/steps/attio-actions";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Attio Actions", () => {
  beforeEach(() => {
    vi.stubEnv("ATTIO_API_KEY", "test-api-key");
    mockFetch.mockReset();
    clearDealStagesCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const mockSuccessResponse = (data: unknown) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data }),
    });
  };

  const mockDealStagesResponse = () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { title: "Lead", is_archived: false },
            { title: "Qualified", is_archived: false },
            { title: "Proposal", is_archived: false },
          ],
        }),
    });
  };

  const mockErrorResponse = (status: number, body: string) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      text: () => Promise.resolve(body),
    });
  };

  describe("createPerson", () => {
    it("creates a person with full name", async () => {
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });

      const input: CreatePersonInput = {
        name: "John Doe",
        email: "john@example.com",
      };
      const result = await createPerson(input);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe("person-123");
      expect(result.recordUrl).toBe("https://app.attio.com/people/person-123");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.values.name.first_name).toBe("John");
      expect(callBody.data.values.name.last_name).toBe("Doe");
      expect(callBody.data.values.email_addresses[0].email_address).toBe("john@example.com");
    });

    it("handles single name (no last name)", async () => {
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });

      const _result = await createPerson({ name: "Madonna" });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.values.name.first_name).toBe("Madonna");
      expect(callBody.data.values.name.last_name).toBe("");
    });

    it("includes phone number when provided", async () => {
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });

      const _result = await createPerson({ name: "Test", phone: "+1234567890" });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.values.phone_numbers[0].phone_number).toBe("+1234567890");
    });

    it("links to company by ID with correct array format", async () => {
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });

      await createPerson({ name: "Test Person", companyId: "company-456" });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.values.company).toEqual([
        {
          target_object: "companies",
          target_record_id: "company-456",
        },
      ]);
    });

    it("returns error on API failure", async () => {
      mockErrorResponse(400, "Invalid request");

      const result = await createPerson({ name: "Test" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("400");
    });

    it("throws when API key missing", async () => {
      vi.stubEnv("ATTIO_API_KEY", "");

      await expect(createPerson({ name: "Test" })).rejects.toThrow("ATTIO_API_KEY not configured");
    });
  });

  describe("createCompany", () => {
    it("creates a company with name and domain", async () => {
      mockSuccessResponse({
        id: { record_id: "company-123" },
        web_url: "https://app.attio.com/companies/company-123",
      });

      const input: CreateCompanyInput = {
        name: "Acme Inc",
        domain: "acme.com",
      };
      const result = await createCompany(input);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe("company-123");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.values.name).toBe("Acme Inc");
      expect(callBody.data.values.domains).toEqual(["acme.com"]);
    });

    it("includes location when provided", async () => {
      mockSuccessResponse({
        id: { record_id: "company-123" },
        web_url: "https://app.attio.com/companies/company-123",
      });

      await createCompany({ name: "Test", location: "San Francisco" });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.values.primary_location).toBe("San Francisco");
    });
  });

  describe("createDeal", () => {
    it("creates a deal with value as plain number", async () => {
      // First call: fetch deal stages
      mockDealStagesResponse();
      // Second call: create deal
      mockSuccessResponse({
        id: { record_id: "deal-123" },
        web_url: "https://app.attio.com/deals/deal-123",
      });

      const input: CreateDealInput = {
        name: "Big Deal",
        value: 50000,
        currency: "EUR", // Currency is ignored - configured at attribute level
      };
      const result = await createDeal(input);

      expect(result.success).toBe(true);

      // Second call is the create deal call
      const callBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      // Currency values are written as plain numbers per Attio API docs
      expect(callBody.data.values.value).toBe(50000);
    });

    it("omits value when not provided", async () => {
      // First call: fetch deal stages
      mockDealStagesResponse();
      // Second call: create deal
      mockSuccessResponse({
        id: { record_id: "deal-123" },
        web_url: "https://app.attio.com/deals/deal-123",
      });

      await createDeal({ name: "Deal" });

      // Second call is the create deal call
      const callBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(callBody.data.values.value).toBeUndefined();
    });

    it("searches for company when companyName provided", async () => {
      // First call: fetch deal stages
      mockDealStagesResponse();
      // Second call: company search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ id: { record_id: "found-company" } }],
          }),
      });
      // Third call: create deal
      mockSuccessResponse({
        id: { record_id: "deal-123" },
        web_url: "https://app.attio.com/deals/deal-123",
      });

      await createDeal({ name: "Deal", companyName: "Acme" });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      const dealBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(dealBody.data.values.associated_company.target_record_id).toBe("found-company");
    });

    it("uses search endpoint when searching for company", async () => {
      // First call: fetch deal stages
      mockDealStagesResponse();
      // Second call: company search using search endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      // Third call: create deal
      mockSuccessResponse({
        id: { record_id: "deal-123" },
        web_url: "https://app.attio.com/deals/deal-123",
      });

      await createDeal({ name: "Deal", companyName: "TechCorp" });

      // Second call (index 1) is the company search
      const [url, options] = mockFetch.mock.calls[1];
      expect(url).toContain("/objects/records/search");
      const searchBody = JSON.parse(options.body);
      expect(searchBody.query).toBe("TechCorp");
      expect(searchBody.objects).toEqual(["companies"]);
    });
  });

  describe("createTask", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-12-05T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("creates a task with content", async () => {
      mockSuccessResponse({
        id: { task_id: "task-123" },
      });

      const input: CreateTaskInput = {
        content: "Follow up with client",
      };
      const result = await createTask(input);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe("task-123");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.content).toBe("Follow up with client");
      expect(callBody.data.format).toBe("plaintext");
      expect(callBody.data.is_completed).toBe(false);
    });

    it('parses relative deadline "tomorrow"', async () => {
      mockSuccessResponse({ id: { task_id: "task-123" } });

      await createTask({ content: "Test", deadline: "tomorrow" });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.deadline_at).toContain("2024-12-06");
    });

    it("includes linked record when provided", async () => {
      mockSuccessResponse({ id: { task_id: "task-123" } });

      await createTask({
        content: "Test",
        linkedRecordId: "company-456",
        linkedRecordObject: "companies",
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.linked_records[0].target_record_id).toBe("company-456");
      expect(callBody.data.linked_records[0].target_object).toBe("companies");
    });

    it("includes assignee when provided", async () => {
      mockSuccessResponse({ id: { task_id: "task-123" } });

      await createTask({
        content: "Test",
        assigneeId: "member-789",
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.assignees[0].referenced_actor_id).toBe("member-789");
    });
  });

  describe("createNote", () => {
    it("creates a note on a company", async () => {
      mockSuccessResponse({
        id: { note_id: "note-123" },
      });

      const input: CreateNoteInput = {
        parentObject: "companies",
        parentRecordId: "company-456",
        title: "Meeting Notes",
        content: "# Summary\n\nDiscussed roadmap.",
      };
      const result = await createNote(input);

      expect(result.success).toBe(true);
      expect(result.noteId).toBe("note-123");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.parent_object).toBe("companies");
      expect(callBody.data.parent_record_id).toBe("company-456");
      expect(callBody.data.format).toBe("markdown");
    });
  });

  describe("addToList", () => {
    it("adds a record to a list", async () => {
      mockSuccessResponse({
        id: { entry_id: "entry-123" },
      });

      const result = await addToList({
        listApiSlug: "sales-pipeline",
        recordId: "person-456",
      });

      expect(result.success).toBe(true);
      expect(result.recordId).toBe("entry-123");

      expect(mockFetch.mock.calls[0][0]).toContain("/lists/sales-pipeline/entries");
    });
  });

  describe("searchRecords", () => {
    it("searches for companies by name using search endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "company-1" },
                object_slug: "companies",
                record_text: "Acme Corp",
                domains: ["acme.com"],
              },
              {
                id: { record_id: "company-2" },
                object_slug: "companies",
                record_text: "Acme Inc",
              },
            ],
          }),
      });

      const results = await searchRecords("companies", "Acme");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("company-1");
      expect(results[0].name).toBe("Acme Corp");
      expect(results[0].extra).toBe("acme.com");
      expect(results[1].name).toBe("Acme Inc");
    });

    it("handles records with missing record_text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "company-1" },
                object_slug: "companies",
                record_text: "",
              },
            ],
          }),
      });

      const results = await searchRecords("companies", "Test");

      expect(results[0].name).toBe("Unknown");
    });

    it("uses the search endpoint with correct request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await searchRecords("companies", "TechCorp");

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

    it("searchRecords works for different object types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "person-1" },
                object_slug: "people",
                record_text: "John Doe",
              },
            ],
          }),
      });

      const results = await searchRecords("people", "John");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("John Doe");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.objects).toEqual(["people"]);
    });
  });

  describe("executeActionWithNote", () => {
    it("creates a person and attaches a note", async () => {
      // Create person response
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });
      // Create note response
      mockSuccessResponse({
        id: { note_id: "note-456" },
      });

      const result = await executeActionWithNote(
        {
          intent: "create_person",
          extractedData: {
            name: "John Doe",
            email: "john@example.com",
          },
          noteTitle: "Telegram Notes",
          targetObject: "people",
        },
        "Message content here"
      );

      expect(result.success).toBe(true);
      expect(result.recordId).toBe("person-123");
      expect(result.noteId).toBe("note-456");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("executes prerequisite actions before main action", async () => {
      // Search for existing company (returns empty - not found)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      // Create company (prerequisite)
      mockSuccessResponse({
        id: { record_id: "company-prereq" },
        web_url: "https://app.attio.com/companies/company-prereq",
      });
      // Create person (main)
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });
      // Create note
      mockSuccessResponse({
        id: { note_id: "note-456" },
      });

      const result = await executeActionWithNote(
        {
          intent: "create_person",
          extractedData: { name: "John Doe" },
          noteTitle: "Notes",
          targetObject: "people",
          prerequisiteActions: [
            {
              intent: "create_company",
              extractedData: { name: "Acme Inc" },
            },
          ],
        },
        "Content"
      );

      expect(result.success).toBe(true);
      expect(result.createdPrerequisites).toHaveLength(1);
      expect(result.createdPrerequisites![0].name).toContain("Acme Inc");
    });

    it("reuses existing company in prerequisite actions", async () => {
      // Search for existing company (returns existing company)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "existing-company-123" },
                object_slug: "companies",
                record_text: "Acme Inc",
              },
            ],
          }),
      });
      // Create person (main) - no company creation needed
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });
      // Create note
      mockSuccessResponse({
        id: { note_id: "note-456" },
      });

      const result = await executeActionWithNote(
        {
          intent: "create_person",
          extractedData: { name: "John Doe" },
          noteTitle: "Notes",
          targetObject: "people",
          prerequisiteActions: [
            {
              intent: "create_company",
              extractedData: { name: "Acme Inc" },
            },
          ],
        },
        "Content"
      );

      expect(result.success).toBe(true);
      // Should NOT have created prerequisites since company already existed
      expect(result.createdPrerequisites).toBeUndefined();
      // Should have made 3 calls: search, create person, create note (no create company)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("returns error for unknown intent", async () => {
      const result = await executeActionWithNote(
        {
          intent: "unknown_action",
          extractedData: {},
          noteTitle: "Notes",
          targetObject: "people",
        },
        "Content"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown intent");
    });

    it("handles create_company intent", async () => {
      mockSuccessResponse({
        id: { record_id: "company-123" },
        web_url: "https://app.attio.com/companies/company-123",
      });
      mockSuccessResponse({ id: { note_id: "note-1" } });

      const result = await executeActionWithNote(
        {
          intent: "create_company",
          extractedData: { name: "TechCorp", domains: "techcorp.com" },
          noteTitle: "Notes",
          targetObject: "companies",
        },
        "Content"
      );

      expect(result.success).toBe(true);
      expect(result.recordId).toBe("company-123");
    });

    it("handles create_deal intent with company search", async () => {
      // Search for company (response needs values object)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "found-company" },
                values: { name: [{ value: "Acme Corp" }] },
              },
            ],
          }),
      });
      // Create deal
      mockSuccessResponse({
        id: { record_id: "deal-123" },
        web_url: "https://app.attio.com/deals/deal-123",
      });
      // Create note
      mockSuccessResponse({ id: { note_id: "note-1" } });

      const result = await executeActionWithNote(
        {
          intent: "create_deal",
          extractedData: {
            name: "Big Deal",
            value: { amount: 50000, currency: "USD" },
            associated_company: "Acme",
          },
          noteTitle: "Notes",
          targetObject: "deals",
        },
        "Content"
      );

      expect(result.success).toBe(true);
    });

    it("handles create_task intent", async () => {
      mockSuccessResponse({ id: { task_id: "task-123" } });

      const result = await executeActionWithNote(
        {
          intent: "create_task",
          extractedData: { content: "Follow up" },
          noteTitle: "Notes",
          targetObject: "tasks",
        },
        ""
      );

      expect(result.success).toBe(true);
      expect(result.recordId).toBe("task-123");
    });

    it("uses search endpoint for company lookup in create_deal", async () => {
      // Search for company using search endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      // Create deal
      mockSuccessResponse({
        id: { record_id: "deal-123" },
        web_url: "https://app.attio.com/deals/deal-123",
      });
      // Create note
      mockSuccessResponse({ id: { note_id: "note-1" } });

      await executeActionWithNote(
        {
          intent: "create_deal",
          extractedData: {
            name: "Deal",
            associated_company: "TechCorp",
          },
          noteTitle: "Notes",
          targetObject: "deals",
        },
        "Content"
      );

      // First call should be the company search using search endpoint
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/objects/records/search");
      const searchBody = JSON.parse(options.body);
      expect(searchBody.query).toBe("TechCorp");
      expect(searchBody.objects).toEqual(["companies"]);
    });

    it("uses search endpoint for company lookup in create_person", async () => {
      // Search for company using search endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "company-1" },
                object_slug: "companies",
                record_text: "Acme Corp",
              },
            ],
          }),
      });
      // Create person
      mockSuccessResponse({
        id: { record_id: "person-123" },
        web_url: "https://app.attio.com/people/person-123",
      });
      // Create note
      mockSuccessResponse({ id: { note_id: "note-1" } });

      await executeActionWithNote(
        {
          intent: "create_person",
          extractedData: {
            name: "John Doe",
            associated_company: "Acme",
          },
          noteTitle: "Notes",
          targetObject: "people",
        },
        "Content"
      );

      // First call should be the company search using search endpoint
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/objects/records/search");
      const searchBody = JSON.parse(options.body);
      expect(searchBody.query).toBe("Acme");
      expect(searchBody.objects).toEqual(["companies"]);
    });

    it("uses search endpoint for company lookup in add_note", async () => {
      // Search for company using search endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: "company-1" },
                object_slug: "companies",
                record_text: "Acme Corp",
              },
            ],
          }),
      });
      // Create note
      mockSuccessResponse({ id: { note_id: "note-1" } });

      await executeActionWithNote(
        {
          intent: "add_note",
          extractedData: {
            company: "Acme",
          },
          noteTitle: "Meeting Notes",
          targetObject: "companies",
        },
        "Note content"
      );

      // First call should be the company search using search endpoint
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/objects/records/search");
      const searchBody = JSON.parse(options.body);
      expect(searchBody.query).toBe("Acme");
      expect(searchBody.objects).toEqual(["companies"]);
    });
  });
});
