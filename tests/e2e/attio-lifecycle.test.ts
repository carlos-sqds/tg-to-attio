/**
 * E2E Attio API Tests
 *
 * These tests require ATTIO_API_KEY environment variable.
 * They create real records in Attio and clean them up afterward.
 *
 * Run with: npm run test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env" });

const ATTIO_BASE_URL = "https://api.attio.com/v2";
const TEST_TIMESTAMP = Date.now();
const TEST_PREFIX = `__TEST_${TEST_TIMESTAMP}__`;
const TEST_DOMAIN = `test-e2e-${TEST_TIMESTAMP}.com`;

// Track created records for cleanup
const createdRecords: Array<{ type: string; id: string }> = [];

// Workspace-specific defaults (fetched dynamically)
interface WorkspaceDefaults {
  dealStage: string;
  ownerEmail: string;
}
let workspaceDefaults: WorkspaceDefaults | null = null;

async function attioRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const response = await fetch(`${ATTIO_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Attio API error: ${response.status} - ${body}`);
  }

  return response.json() as Promise<T>;
}

async function deleteRecord(objectSlug: string, recordId: string): Promise<void> {
  try {
    await fetch(`${ATTIO_BASE_URL}/objects/${objectSlug}/records/${recordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
      },
    });
  } catch {
    console.warn(`Failed to delete ${objectSlug}/${recordId}`);
  }
}

async function deleteTask(taskId: string): Promise<void> {
  try {
    await fetch(`${ATTIO_BASE_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
      },
    });
  } catch {
    console.warn(`Failed to delete task ${taskId}`);
  }
}

async function deleteNote(noteId: string): Promise<void> {
  try {
    await fetch(`${ATTIO_BASE_URL}/notes/${noteId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
      },
    });
  } catch {
    console.warn(`Failed to delete note ${noteId}`);
  }
}

/**
 * Fetch workspace-specific defaults for creating deals
 * This makes the test portable across different Attio workspaces
 */
async function fetchWorkspaceDefaults(): Promise<WorkspaceDefaults> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  // Fetch first available deal stage
  const stagesResponse = await fetch(`${ATTIO_BASE_URL}/objects/deals/attributes/stage/statuses`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const stagesData = (await stagesResponse.json()) as {
    data: Array<{ title: string; is_archived: boolean }>;
  };
  const availableStage = stagesData.data.find((s) => !s.is_archived);
  if (!availableStage) {
    throw new Error("No available deal stages found in workspace");
  }

  // Fetch first workspace member for owner
  const membersResponse = await fetch(`${ATTIO_BASE_URL}/workspace_members`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const membersData = (await membersResponse.json()) as {
    data: Array<{ email_address: string }>;
  };
  if (membersData.data.length === 0) {
    throw new Error("No workspace members found");
  }

  return {
    dealStage: availableStage.title,
    ownerEmail: membersData.data[0].email_address,
  };
}

describe("E2E Attio Lifecycle", () => {
  let companyId: string;
  let personId: string;
  let dealId: string;
  let taskId: string;
  let noteId: string;

  beforeAll(async () => {
    if (!process.env.ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY required for E2E tests");
    }
    // Fetch workspace-specific defaults for deal creation
    workspaceDefaults = await fetchWorkspaceDefaults();
    console.log("Workspace defaults:", workspaceDefaults);
  });

  afterAll(async () => {
    // Cleanup in reverse order of creation
    console.log(`\nCleaning up ${createdRecords.length} test records...`);

    for (const record of createdRecords.reverse()) {
      if (record.type === "task") {
        await deleteTask(record.id);
      } else if (record.type === "note") {
        await deleteNote(record.id);
      } else {
        await deleteRecord(record.type, record.id);
      }
    }
  });

  it("creates a company and verifies it exists", async () => {
    const companyData = {
      data: {
        values: {
          name: `${TEST_PREFIX} Test Company`,
          domains: [TEST_DOMAIN],
        },
      },
    };

    const response = await attioRequest<{
      data: { id: { record_id: string }; values: { name: Array<{ value: string }> } };
    }>("/objects/companies/records", {
      method: "POST",
      body: JSON.stringify(companyData),
    });

    companyId = response.data.id.record_id;
    createdRecords.push({ type: "companies", id: companyId });

    expect(companyId).toBeDefined();
    expect(response.data.values.name[0].value).toContain(TEST_PREFIX);

    // Verify with GET
    const getResponse = await attioRequest<{
      data: { id: { record_id: string } };
    }>(`/objects/companies/records/${companyId}`);

    expect(getResponse.data.id.record_id).toBe(companyId);
  });

  it("creates a person linked to the company", async () => {
    const personData = {
      data: {
        values: {
          name: {
            first_name: "Test",
            last_name: `${TEST_PREFIX} Person`,
            full_name: `Test ${TEST_PREFIX} Person`,
          },
          email_addresses: [{ email_address: `test-e2e-${TEST_TIMESTAMP}@example.com` }],
        },
      },
    };

    const response = await attioRequest<{
      data: {
        id: { record_id: string };
        values: { name: Array<{ full_name: string }> };
      };
    }>("/objects/people/records", {
      method: "POST",
      body: JSON.stringify(personData),
    });

    personId = response.data.id.record_id;
    createdRecords.push({ type: "people", id: personId });

    expect(personId).toBeDefined();
    expect(response.data.values.name[0].full_name).toContain(TEST_PREFIX);

    // Verify with GET
    const getResponse = await attioRequest<{
      data: { id: { record_id: string } };
    }>(`/objects/people/records/${personId}`);

    expect(getResponse.data.id.record_id).toBe(personId);
  });

  it("creates a deal for the company", async () => {
    if (!workspaceDefaults) {
      throw new Error("Workspace defaults not loaded");
    }

    const dealData = {
      data: {
        values: {
          name: `${TEST_PREFIX} Test Deal`,
          stage: workspaceDefaults.dealStage,
          owner: workspaceDefaults.ownerEmail,
          value: 50000, // Currency values are written as plain numbers
          associated_company: {
            target_object: "companies",
            target_record_id: companyId,
          },
        },
      },
    };

    const response = await attioRequest<{
      data: {
        id: { record_id: string };
        values: {
          name: Array<{ value: string }>;
          value: Array<{ currency_value: number; currency_code: string }>;
          stage: Array<{ status: { title: string } }>;
        };
      };
    }>("/objects/deals/records", {
      method: "POST",
      body: JSON.stringify(dealData),
    });

    dealId = response.data.id.record_id;
    createdRecords.push({ type: "deals", id: dealId });

    expect(dealId).toBeDefined();
    expect(response.data.values.name[0].value).toContain(TEST_PREFIX);
    expect(response.data.values.value[0].currency_value).toBe(50000);
    expect(response.data.values.stage[0].status.title).toBe(workspaceDefaults.dealStage);
  });

  it("creates a task linked to the company", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const deadlineStr = tomorrow.toISOString().replace(/\.\d{3}Z$/, ".000000000Z");

    const taskData = {
      data: {
        content: `${TEST_PREFIX} Follow up with client`,
        format: "plaintext",
        is_completed: false,
        deadline_at: deadlineStr,
        linked_records: [
          {
            target_object: "companies",
            target_record_id: companyId,
          },
        ],
        assignees: [],
      },
    };

    const response = await attioRequest<{
      data: {
        id: { task_id: string };
        content_plaintext: string;
        deadline_at: string;
      };
    }>("/tasks", {
      method: "POST",
      body: JSON.stringify(taskData),
    });

    taskId = response.data.id.task_id;
    createdRecords.push({ type: "task", id: taskId });

    expect(taskId).toBeDefined();
    expect(response.data.content_plaintext).toContain(TEST_PREFIX);
    expect(response.data.deadline_at).toBeDefined();
  });

  it("adds a note to the company", async () => {
    const noteData = {
      data: {
        parent_object: "companies",
        parent_record_id: companyId,
        title: `${TEST_PREFIX} Meeting Notes`,
        format: "markdown",
        content: `# Summary\n\nThis is a test note created by E2E tests.\n\n- Point 1\n- Point 2`,
      },
    };

    const response = await attioRequest<{
      data: {
        id: { note_id: string };
        title: string;
        content_markdown: string;
      };
    }>("/notes", {
      method: "POST",
      body: JSON.stringify(noteData),
    });

    noteId = response.data.id.note_id;
    createdRecords.push({ type: "note", id: noteId });

    expect(noteId).toBeDefined();
    expect(response.data.title).toContain(TEST_PREFIX);
    expect(response.data.content_markdown).toContain("Summary");
  });

  it("can search for the created company", async () => {
    const searchData = {
      filter: {
        name: {
          $contains: TEST_PREFIX,
        },
      },
      limit: 10,
    };

    const response = await attioRequest<{
      data: Array<{
        id: { record_id: string };
        values: { name: Array<{ value: string }> };
      }>;
    }>("/objects/companies/records/query", {
      method: "POST",
      body: JSON.stringify(searchData),
    });

    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data.some((c) => c.id.record_id === companyId)).toBe(true);
  });

  it("can update the company", async () => {
    const updateData = {
      data: {
        values: {
          description: `${TEST_PREFIX} Updated description`,
        },
      },
    };

    const response = await attioRequest<{
      data: {
        id: { record_id: string };
        values: { description: Array<{ value: string }> };
      };
    }>(`/objects/companies/records/${companyId}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });

    expect(response.data.values.description[0].value).toContain("Updated description");
  });
});

describe("E2E Attio Error Handling", () => {
  beforeAll(() => {
    if (!process.env.ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY required for E2E tests");
    }
  });

  it("returns error for non-existent record", async () => {
    // Use a valid UUID format but non-existent ID
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    try {
      await attioRequest(`/objects/companies/records/${fakeUuid}`);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/4\d{2}/); // 400 or 404 level error
    }
  });

  it("returns error for invalid record ID format", async () => {
    try {
      await attioRequest("/objects/companies/records/not-a-uuid");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("400");
    }
  });
});
