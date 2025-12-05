import type { ActionResult } from "@/src/services/attio/schema-types";

const ATTIO_BASE_URL = "https://api.attio.com/v2";

async function attioRequest<T>(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ATTIO_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Attio API error: ${response.status} - ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

interface AttioRecordResponse {
  data: {
    id: { record_id: string };
    web_url: string;
  };
}

interface AttioNoteResponse {
  data: {
    id: { note_id: string };
  };
}

interface AttioTaskResponse {
  data: {
    id: { task_id: string };
  };
}

interface AttioEntryResponse {
  data: {
    id: { entry_id: string };
  };
}

// ============ PERSON OPERATIONS ============

export interface CreatePersonInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  description?: string;
}

export async function createPerson(input: CreatePersonInput): Promise<ActionResult> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const values: Record<string, unknown> = {};

  // Name is required - format as personal name
  if (input.name) {
    const nameParts = input.name.split(" ");
    values.name = {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      full_name: input.name,
    };
  }

  if (input.email) {
    values.email_addresses = [{ email_address: input.email }];
  }

  if (input.phone) {
    values.phone_numbers = [{ phone_number: input.phone }];
  }

  if (input.company) {
    // Reference company by name - Attio will match or create
    values.company = {
      target_object: "companies",
      target_record_id: null, // Let Attio match by name
      display_name: input.company,
    };
  }

  if (input.jobTitle) {
    values.job_title = input.jobTitle;
  }

  if (input.description) {
    values.description = input.description;
  }

  try {
    const response = await attioRequest<AttioRecordResponse>(
      "/objects/people/records",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({ data: { values } }),
      }
    );

    return {
      success: true,
      recordId: response.data.id.record_id,
      recordUrl: response.data.web_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ COMPANY OPERATIONS ============

export interface CreateCompanyInput {
  name: string;
  domain?: string;
  location?: string;
  description?: string;
}

export async function createCompany(input: CreateCompanyInput): Promise<ActionResult> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const values: Record<string, unknown> = {
    name: input.name,
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

  try {
    const response = await attioRequest<AttioRecordResponse>(
      "/objects/companies/records",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({ data: { values } }),
      }
    );

    return {
      success: true,
      recordId: response.data.id.record_id,
      recordUrl: response.data.web_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ DEAL OPERATIONS ============

export interface CreateDealInput {
  name: string;
  value?: number;
  currency?: string;
  stage?: string;
  companyName?: string;
  companyId?: string;
  ownerEmail?: string;
}

export async function createDeal(input: CreateDealInput): Promise<ActionResult> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const values: Record<string, unknown> = {
    name: input.name,
  };

  if (input.value !== undefined) {
    values.value = {
      value: input.value,
      currency: input.currency || "USD",
    };
  }

  if (input.stage) {
    values.stage = input.stage;
  }

  if (input.companyId) {
    values.associated_company = {
      target_object: "companies",
      target_record_id: input.companyId,
    };
  } else if (input.companyName) {
    // Search for company first
    const searchResponse = await attioRequest<{ data: Array<{ id: { record_id: string } }> }>(
      "/objects/companies/records/query",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { name: { value: { $contains: input.companyName } } },
          limit: 1,
        }),
      }
    );

    if (searchResponse.data.length > 0) {
      values.associated_company = {
        target_object: "companies",
        target_record_id: searchResponse.data[0].id.record_id,
      };
    }
  }

  if (input.ownerEmail) {
    values.owner = input.ownerEmail;
  }

  try {
    const response = await attioRequest<AttioRecordResponse>(
      "/objects/deals/records",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({ data: { values } }),
      }
    );

    return {
      success: true,
      recordId: response.data.id.record_id,
      recordUrl: response.data.web_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ TASK OPERATIONS ============

export interface CreateTaskInput {
  content: string;
  assigneeId?: string;
  assigneeEmail?: string;
  deadline?: unknown; // Can be ISO string, relative date, or various formats
  linkedRecordId?: string;
  linkedRecordObject?: string; // "people", "companies", "deals"
}

function parseDeadline(deadline: unknown): string | null {
  if (!deadline) return null;
  
  // Convert to string if needed
  const deadlineStr = typeof deadline === "string" ? deadline : String(deadline);
  if (!deadlineStr || deadlineStr === "undefined" || deadlineStr === "null") return null;
  
  const now = new Date();
  const lowerDeadline = deadlineStr.toLowerCase().trim();
  
  // Handle relative dates first (before trying Date parsing)
  if (lowerDeadline.includes("tomorrow")) {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0); // 9 AM
    return now.toISOString();
  }
  
  if (lowerDeadline.includes("next week") || lowerDeadline === "1 week" || lowerDeadline === "a week") {
    now.setDate(now.getDate() + 7);
    now.setHours(9, 0, 0, 0);
    return now.toISOString();
  }
  
  // Handle "next wednesday", "next monday", etc.
  const dayMatch = lowerDeadline.match(/(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (dayMatch) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDay = days.indexOf(dayMatch[1].toLowerCase());
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    now.setDate(now.getDate() + daysUntil);
    now.setHours(9, 0, 0, 0);
    return now.toISOString();
  }
  
  // Handle "in X days" or "X days"
  const daysMatch = lowerDeadline.match(/(?:in\s+)?(\d+)\s*days?/i);
  if (daysMatch) {
    now.setDate(now.getDate() + parseInt(daysMatch[1], 10));
    now.setHours(9, 0, 0, 0);
    return now.toISOString();
  }
  
  // Handle "end of week", "eow"
  if (lowerDeadline.includes("end of week") || lowerDeadline === "eow") {
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilFriday);
    now.setHours(17, 0, 0, 0);
    return now.toISOString();
  }
  
  // Only try ISO date parsing for strings that look like dates (YYYY-MM-DD format)
  const isoMatch = deadlineStr.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const isoDate = new Date(deadlineStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }
  }
  
  // Don't try to parse arbitrary strings - return null for unrecognized formats
  return null;
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  // Build linked_records array (required by Attio, even if empty)
  const linkedRecords: Array<{ target_object: string; target_record_id: string }> = [];
  if (input.linkedRecordId && input.linkedRecordObject) {
    linkedRecords.push({
      target_object: input.linkedRecordObject,
      target_record_id: input.linkedRecordId,
    });
  }

  // Build assignees array (required by Attio, even if empty)
  const assignees: Array<{ referenced_actor_type: string; referenced_actor_id: string }> = [];
  if (input.assigneeId) {
    assignees.push({
      referenced_actor_type: "workspace-member",
      referenced_actor_id: input.assigneeId,
    });
  }

  const data: Record<string, unknown> = {
    content: input.content,
    format: "plaintext",
    is_completed: false,
    linked_records: linkedRecords,
    assignees: assignees,
  };

  // Parse and validate deadline
  const parsedDeadline = parseDeadline(input.deadline);
  if (parsedDeadline) {
    data.deadline_at = parsedDeadline;
  }

  try {
    const response = await attioRequest<AttioTaskResponse>(
      "/tasks",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({ data }),
      }
    );

    return {
      success: true,
      recordId: response.data.id.task_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ NOTE OPERATIONS ============

export interface CreateNoteInput {
  parentObject: "companies" | "people" | "deals";
  parentRecordId: string;
  title: string;
  content: string;
}

export async function createNote(input: CreateNoteInput): Promise<ActionResult> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  try {
    const response = await attioRequest<AttioNoteResponse>(
      "/notes",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            parent_object: input.parentObject,
            parent_record_id: input.parentRecordId,
            title: input.title,
            format: "markdown",
            content: input.content,
          },
        }),
      }
    );

    return {
      success: true,
      noteId: response.data.id.note_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ LIST OPERATIONS ============

export interface AddToListInput {
  listApiSlug: string;
  recordId: string;
}

export async function addToList(input: AddToListInput): Promise<ActionResult> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  try {
    const response = await attioRequest<AttioEntryResponse>(
      `/lists/${input.listApiSlug}/entries`,
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            record_id: input.recordId,
          },
        }),
      }
    );

    return {
      success: true,
      recordId: response.data.id.entry_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ SEARCH OPERATIONS ============

export interface SearchResult {
  id: string;
  name: string;
  extra?: string;
}

export async function searchRecords(
  objectSlug: string,
  query: string
): Promise<SearchResult[]> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const response = await attioRequest<{
    data: Array<{
      id: { record_id: string };
      values: {
        name?: Array<{ value?: string; full_name?: string }>;
        domains?: Array<{ domain: string }>;
      };
    }>;
  }>(
    `/objects/${objectSlug}/records/query`,
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          name: { value: { $contains: query } },
        },
        limit: 10,
      }),
    }
  );

  return response.data.map((record) => {
    const nameValue = record.values.name?.[0];
    const name = nameValue?.full_name || nameValue?.value || "Unknown";
    const domain = record.values.domains?.[0]?.domain;

    return {
      id: record.id.record_id,
      name,
      extra: domain,
    };
  });
}

// ============ COMPOSITE OPERATIONS ============

/**
 * Execute an action and always attach a note with the original messages
 */
export async function executeActionWithNote(
  action: {
    intent: string;
    extractedData: Record<string, unknown>;
    noteTitle: string;
    targetObject: string;
    targetList?: string;
    prerequisiteActions?: Array<{
      intent: string;
      extractedData: Record<string, unknown>;
    }>;
  },
  messagesContent: string
): Promise<ActionResult> {
  "use step";

  let result: ActionResult;
  let parentObject: "companies" | "people" | "deals" = "companies";
  let parentRecordId: string | undefined;
  
  // Track created prerequisite records for linking
  const createdRecords: Record<string, string> = {}; // intent -> recordId

  const data = action.extractedData;

  // Execute prerequisite actions first
  if (action.prerequisiteActions && action.prerequisiteActions.length > 0) {
    for (const prereq of action.prerequisiteActions) {
      let prereqResult: ActionResult | null = null;
      
      switch (prereq.intent) {
        case "create_company": {
          prereqResult = await createCompany({
            name: String(prereq.extractedData.name || ""),
            domain: String(prereq.extractedData.domains || prereq.extractedData.domain || ""),
            location: String(prereq.extractedData.primary_location || ""),
          });
          if (prereqResult.success && prereqResult.recordId) {
            createdRecords["company"] = prereqResult.recordId;
          }
          break;
        }
        case "create_person": {
          prereqResult = await createPerson({
            name: String(prereq.extractedData.name || ""),
            email: String(prereq.extractedData.email || ""),
            company: createdRecords["company"] ? undefined : String(prereq.extractedData.company || ""),
          });
          if (prereqResult.success && prereqResult.recordId) {
            createdRecords["person"] = prereqResult.recordId;
          }
          break;
        }
      }

      if (prereqResult && !prereqResult.success) {
        return {
          success: false,
          error: `Failed to create prerequisite: ${prereqResult.error}`,
        };
      }
    }
  }

  switch (action.intent) {
    case "create_person": {
      // Use prerequisite company if created
      const companyName = createdRecords["company"] ? undefined : String(data.company || "");
      
      result = await createPerson({
        name: String(data.name || data.full_name || ""),
        email: String(data.email_addresses || data.email || ""),
        phone: String(data.phone_numbers || data.phone || ""),
        company: companyName,
        jobTitle: String(data.job_title || ""),
        description: String(data.description || ""),
      });
      parentObject = "people";
      parentRecordId = result.recordId;
      break;
    }

    case "create_company": {
      result = await createCompany({
        name: String(data.name || ""),
        domain: String(data.domains || data.domain || ""),
        location: String(data.primary_location || data.location || ""),
        description: String(data.description || ""),
      });
      parentObject = "companies";
      parentRecordId = result.recordId;
      break;
    }

    case "create_deal": {
      const valueData = data.value as { amount?: number; currency?: string } | number | undefined;
      const value = typeof valueData === "object" ? valueData?.amount : valueData;
      const currency = typeof valueData === "object" ? valueData?.currency : "USD";

      // Use prerequisite company if created
      const companyId = createdRecords["company"];
      const companyName = companyId ? undefined : String(data.associated_company || data.company || "");

      result = await createDeal({
        name: String(data.name || ""),
        value: value as number | undefined,
        currency: String(currency || "USD"),
        stage: String(data.stage || ""),
        companyName,
        companyId,
      });
      parentObject = "deals";
      parentRecordId = result.recordId;
      break;
    }

    case "create_task": {
      // Use prerequisite company/person if created
      let linkedRecordId = String(data.linked_record_id || "");
      let linkedRecordObject = String(data.linked_record_object || "");
      
      if (!linkedRecordId && createdRecords["company"]) {
        linkedRecordId = createdRecords["company"];
        linkedRecordObject = "companies";
      } else if (!linkedRecordId && createdRecords["person"]) {
        linkedRecordId = createdRecords["person"];
        linkedRecordObject = "people";
      }

      result = await createTask({
        content: String(data.content || ""),
        assigneeEmail: String(data.assignee_email || ""),
        deadline: data.deadline_at || data.due_date || data.deadline, // AI may use different field names
        linkedRecordId,
        linkedRecordObject,
      });
      // Tasks don't support notes directly, return early
      return result;
    }

    case "add_note": {
      // For add_note, we need to find the target record first
      const targetCompany = String(data.company || data.associated_company || "");
      const targetPerson = String(data.person || "");

      if (targetCompany) {
        const companies = await searchRecords("companies", targetCompany);
        if (companies.length > 0) {
          parentObject = "companies";
          parentRecordId = companies[0].id;
        }
      } else if (targetPerson) {
        const people = await searchRecords("people", targetPerson);
        if (people.length > 0) {
          parentObject = "people";
          parentRecordId = people[0].id;
        }
      }

      if (!parentRecordId) {
        return {
          success: false,
          error: "Could not find target record for note",
        };
      }

      result = { success: true, recordId: parentRecordId };
      break;
    }

    case "add_to_list": {
      // First create or find the record, then add to list
      const listSlug = String(action.targetList || data.list || "");
      const recordId = String(data.record_id || "");

      if (!listSlug || !recordId) {
        return {
          success: false,
          error: "Missing list or record ID",
        };
      }

      result = await addToList({
        listApiSlug: listSlug,
        recordId: recordId,
      });
      // For list entries, attach note to the parent record
      parentObject = action.targetObject as "companies" | "people" | "deals";
      parentRecordId = recordId;
      break;
    }

    default:
      return {
        success: false,
        error: `Unknown intent: ${action.intent}`,
      };
  }

  // Always create a note with the original messages
  if (result.success && parentRecordId && messagesContent) {
    const noteResult = await createNote({
      parentObject,
      parentRecordId,
      title: action.noteTitle,
      content: messagesContent,
    });
    result.noteId = noteResult.noteId;
  }

  return result;
}
