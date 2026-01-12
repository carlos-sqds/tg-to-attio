/**
 * Attio API test client with automatic cleanup.
 * All test resources are prefixed with [TEST] for visibility.
 */

import { config } from "dotenv";

// Load .env.local first (has priority), then .env
config({ path: ".env.local" });
config({ path: ".env" });

const ATTIO_BASE_URL = "https://api.attio.com/v2";
const TEST_PREFIX = "[TEST] ";

// ============ Types ============

export interface CreatePersonInput {
  name: string;
  email?: string;
  phone?: string;
  companyId?: string;
  jobTitle?: string;
  description?: string;
}

export interface CreateCompanyInput {
  name: string;
  domain?: string;
  location?: string;
  description?: string;
}

export interface CreateDealInput {
  name: string;
  value?: number;
  companyId?: string;
  ownerEmail?: string;
}

export interface CreateTaskInput {
  content: string;
  assigneeId?: string;
  deadline?: string;
  linkedRecordId?: string;
  linkedRecordObject?: string;
}

export interface CreateNoteInput {
  parentObject: "companies" | "people" | "deals";
  parentRecordId: string;
  title: string;
  content: string;
}

export interface RecordResult {
  recordId: string;
  recordUrl?: string;
}

export interface NoteResult {
  noteId: string;
}

export interface TaskResult {
  taskId: string;
}

interface CreatedRecord {
  type: "people" | "companies" | "deals" | "tasks" | "notes";
  id: string;
}

// ============ Attio Test Client ============

export class AttioTestClient {
  private apiKey: string;
  private createdRecords: CreatedRecord[] = [];

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ATTIO_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("ATTIO_API_KEY not configured for tests");
    }
  }

  // ============ API Helpers ============

  private async request<T>(endpoint: string, options: RequestInit = {}, retries = 3): Promise<T> {
    const url = `${ATTIO_BASE_URL}${endpoint}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Handle rate limiting with exponential backoff
      if (response.status === 429 && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Attio API error: ${response.status} - ${errorBody}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return response.json() as Promise<T>;
    }

    throw new Error(`Attio API error: Rate limit exceeded after ${retries} retries`);
  }

  private ensureTestPrefix(name: string): string {
    if (name.startsWith(TEST_PREFIX)) {
      return name;
    }
    return `${TEST_PREFIX}${name}`;
  }

  // ============ Create Operations ============

  async createPerson(input: CreatePersonInput): Promise<RecordResult> {
    const name = this.ensureTestPrefix(input.name);
    const nameParts = name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const values: Record<string, unknown> = {
      name: {
        first_name: firstName,
        last_name: lastName,
        full_name: name,
      },
    };

    if (input.email) {
      values.email_addresses = [{ email_address: input.email }];
    }

    if (input.phone) {
      values.phone_numbers = [{ original_phone_number: input.phone }];
    }

    if (input.companyId) {
      values.company = [
        {
          target_object: "companies",
          target_record_id: input.companyId,
        },
      ];
    }

    if (input.jobTitle) {
      values.job_title = input.jobTitle;
    }

    if (input.description) {
      values.description = input.description;
    }

    const response = await this.request<{
      data: { id: { record_id: string }; web_url: string };
    }>("/objects/people/records", {
      method: "POST",
      body: JSON.stringify({ data: { values } }),
    });

    const recordId = response.data.id.record_id;
    this.createdRecords.push({ type: "people", id: recordId });

    return {
      recordId,
      recordUrl: response.data.web_url,
    };
  }

  async createCompany(input: CreateCompanyInput): Promise<RecordResult> {
    const name = this.ensureTestPrefix(input.name);

    const values: Record<string, unknown> = {
      name,
    };

    if (input.domain) {
      values.domains = [input.domain];
    }

    if (input.location) {
      values.primary_location = input.location;
    }

    if (input.description) {
      values.description = input.description;
    }

    const response = await this.request<{
      data: { id: { record_id: string }; web_url: string };
    }>("/objects/companies/records", {
      method: "POST",
      body: JSON.stringify({ data: { values } }),
    });

    const recordId = response.data.id.record_id;
    this.createdRecords.push({ type: "companies", id: recordId });

    return {
      recordId,
      recordUrl: response.data.web_url,
    };
  }

  async createDeal(input: CreateDealInput): Promise<RecordResult> {
    const name = this.ensureTestPrefix(input.name);

    const values: Record<string, unknown> = {
      name,
    };

    if (input.value !== undefined) {
      values.value = input.value;
    }

    if (input.companyId) {
      values.associated_company = {
        target_object: "companies",
        target_record_id: input.companyId,
      };
    }

    if (input.ownerEmail) {
      values.owner = input.ownerEmail;
    }

    const response = await this.request<{
      data: { id: { record_id: string }; web_url: string };
    }>("/objects/deals/records", {
      method: "POST",
      body: JSON.stringify({ data: { values } }),
    });

    const recordId = response.data.id.record_id;
    this.createdRecords.push({ type: "deals", id: recordId });

    return {
      recordId,
      recordUrl: response.data.web_url,
    };
  }

  async createTask(input: CreateTaskInput): Promise<TaskResult> {
    const content = this.ensureTestPrefix(input.content);

    const linkedRecords: Array<{
      target_object: string;
      target_record_id: string;
    }> = [];
    if (input.linkedRecordId && input.linkedRecordObject) {
      linkedRecords.push({
        target_object: input.linkedRecordObject,
        target_record_id: input.linkedRecordId,
      });
    }

    const assignees: Array<{
      referenced_actor_type: string;
      referenced_actor_id: string;
    }> = [];
    if (input.assigneeId) {
      assignees.push({
        referenced_actor_type: "workspace-member",
        referenced_actor_id: input.assigneeId,
      });
    }

    // Default deadline to 7 days from now if not provided (some workspaces require it)
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    const deadlineStr = input.deadline || defaultDeadline.toISOString();

    const data: Record<string, unknown> = {
      content,
      format: "plaintext",
      is_completed: false,
      linked_records: linkedRecords,
      assignees,
      deadline_at: deadlineStr,
    };

    const response = await this.request<{
      data: { id: { task_id: string } };
    }>("/tasks", {
      method: "POST",
      body: JSON.stringify({ data }),
    });

    const taskId = response.data.id.task_id;
    this.createdRecords.push({ type: "tasks", id: taskId });

    return { taskId };
  }

  async createNote(input: CreateNoteInput): Promise<NoteResult> {
    const title = this.ensureTestPrefix(input.title);

    const response = await this.request<{
      data: { id: { note_id: string } };
    }>("/notes", {
      method: "POST",
      body: JSON.stringify({
        data: {
          parent_object: input.parentObject,
          parent_record_id: input.parentRecordId,
          title,
          format: "markdown",
          content: input.content,
        },
      }),
    });

    const noteId = response.data.id.note_id;
    this.createdRecords.push({ type: "notes", id: noteId });

    return { noteId };
  }

  // ============ Get Operations ============

  async getPerson(recordId: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>(
      `/objects/people/records/${recordId}`
    );
    return response.data;
  }

  async getCompany(recordId: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>(
      `/objects/companies/records/${recordId}`
    );
    return response.data;
  }

  async getDeal(recordId: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>(
      `/objects/deals/records/${recordId}`
    );
    return response.data;
  }

  async getTask(taskId: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>(`/tasks/${taskId}`);
    return response.data;
  }

  async getNote(noteId: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>(`/notes/${noteId}`);
    return response.data;
  }

  // ============ Search Operations ============

  async searchRecords(
    objectSlug: string,
    query: string
  ): Promise<Array<{ id: string; name?: string }>> {
    const response = await this.request<{
      data: Array<{
        id: { record_id: string };
        values?: { name?: unknown };
      }>;
    }>("/objects/records/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        objects: [objectSlug],
        request_as: { type: "workspace" },
        limit: 25,
      }),
    });

    return response.data.map((r) => ({
      id: r.id.record_id,
      name:
        typeof r.values?.name === "string"
          ? r.values.name
          : (r.values?.name as { full_name?: string })?.full_name,
    }));
  }

  // ============ Delete Operations ============

  async deletePerson(recordId: string): Promise<void> {
    await this.request(`/objects/people/records/${recordId}`, {
      method: "DELETE",
    });
  }

  async deleteCompany(recordId: string): Promise<void> {
    await this.request(`/objects/companies/records/${recordId}`, {
      method: "DELETE",
    });
  }

  async deleteDeal(recordId: string): Promise<void> {
    await this.request(`/objects/deals/records/${recordId}`, {
      method: "DELETE",
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request(`/tasks/${taskId}`, {
      method: "DELETE",
    });
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.request(`/notes/${noteId}`, {
      method: "DELETE",
    });
  }

  // ============ Cleanup ============

  /**
   * Delete all records created by this client instance.
   * Deletes in reverse order to handle dependencies (notes first, then companies last).
   */
  async cleanup(): Promise<void> {
    // Order matters: notes/tasks first, then people/deals, then companies last
    const deleteOrder: CreatedRecord["type"][] = ["notes", "tasks", "deals", "people", "companies"];

    const sortedRecords = [...this.createdRecords].sort((a, b) => {
      return deleteOrder.indexOf(a.type) - deleteOrder.indexOf(b.type);
    });

    for (const record of sortedRecords) {
      try {
        switch (record.type) {
          case "people":
            await this.deletePerson(record.id);
            break;
          case "companies":
            await this.deleteCompany(record.id);
            break;
          case "deals":
            await this.deleteDeal(record.id);
            break;
          case "tasks":
            await this.deleteTask(record.id);
            break;
          case "notes":
            await this.deleteNote(record.id);
            break;
        }
      } catch (error) {
        // Log but don't fail cleanup
        console.warn(`Failed to delete ${record.type}/${record.id}:`, error);
      }
    }

    this.createdRecords = [];
  }

  /**
   * Get list of records created by this client (for debugging).
   */
  getCreatedRecords(): CreatedRecord[] {
    return [...this.createdRecords];
  }
}

// ============ Utility Functions ============

/**
 * Create a test client with automatic cleanup on process exit.
 * Useful for ad-hoc testing.
 */
export function createTestClient(apiKey?: string): AttioTestClient {
  const client = new AttioTestClient(apiKey);

  // Register cleanup on process exit
  process.on("beforeExit", async () => {
    await client.cleanup();
  });

  return client;
}

/**
 * Generate a unique test name to avoid conflicts.
 */
export function uniqueTestName(base: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${base} ${timestamp}-${random}`;
}
