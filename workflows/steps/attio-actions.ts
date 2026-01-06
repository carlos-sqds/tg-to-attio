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

async function getRecordUrl(objectSlug: string, recordId: string): Promise<string | undefined> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) return undefined;

  try {
    const response = await attioRequest<{ data: { web_url: string } }>(
      `/objects/${objectSlug}/records/${recordId}`,
      apiKey
    );
    return response.data.web_url;
  } catch {
    return undefined;
  }
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

// Cache for valid deal stages
let dealStagesCache: string[] | null = null;

// Export for testing - clears the deal stages cache
export function clearDealStagesCache() {
  dealStagesCache = null;
}

async function getValidDealStages(apiKey: string): Promise<string[]> {
  if (dealStagesCache) return dealStagesCache;

  try {
    const response = await attioRequest<{
      data: Array<{ title: string; is_archived: boolean }>;
    }>("/objects/deals/attributes/stage/statuses", apiKey);

    dealStagesCache = response.data.filter((s) => !s.is_archived).map((s) => s.title);

    return dealStagesCache;
  } catch (error) {
    console.error("[DEAL] Failed to fetch deal stages:", error);
    return [];
  }
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
    const response = await attioRequest<AttioRecordResponse>("/objects/people/records", apiKey, {
      method: "POST",
      body: JSON.stringify({ data: { values } }),
    });

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
    const response = await attioRequest<AttioRecordResponse>("/objects/companies/records", apiKey, {
      method: "POST",
      body: JSON.stringify({ data: { values } }),
    });

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
  companyName?: string;
  companyId?: string;
  ownerEmail?: string;
  // Note: stage is NOT configurable - always uses workspace's first valid stage
}

export async function createDeal(input: CreateDealInput): Promise<ActionResult> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const values: Record<string, unknown> = {
    name: input.name,
  };

  if (input.value !== undefined) {
    // Currency values are written as plain numbers (Attio ignores currency on write)
    // The currency_code is configured at the attribute level, not per-record
    values.value = input.value;
  }

  // Always use first valid stage - don't rely on AI guessing stage names
  const validStages = await getValidDealStages(apiKey);
  if (validStages.length > 0) {
    values.stage = validStages[0];
  } else {
    console.warn("[DEAL] No valid stages found in workspace");
  }

  if (input.companyId) {
    values.associated_company = {
      target_object: "companies",
      target_record_id: input.companyId,
    };
  } else if (input.companyName) {
    // Search for company using the dedicated search endpoint
    const searchResponse = await attioRequest<{ data: Array<{ id: { record_id: string } }> }>(
      "/objects/records/search",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({
          query: input.companyName,
          objects: ["companies"],
          request_as: { type: "workspace" },
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
    const response = await attioRequest<AttioRecordResponse>("/objects/deals/records", apiKey, {
      method: "POST",
      body: JSON.stringify({ data: { values } }),
    });

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

// Parse company input like "Noah from Noah.com" into name and domain
export function parseCompanyInput(input: string): { name: string; domain?: string } {
  const trimmed = input.trim();

  // Pattern: "CompanyName from domain.com"
  const fromPattern = trimmed.match(/^(.+?)\s+from\s+(\S+\.\S+)$/i);
  if (fromPattern) {
    return { name: fromPattern[1].trim(), domain: fromPattern[2].toLowerCase() };
  }

  // Pattern: "CompanyName (domain.com)"
  const parenPattern = trimmed.match(/^(.+?)\s*\((\S+\.\S+)\)$/);
  if (parenPattern) {
    return { name: parenPattern[1].trim(), domain: parenPattern[2].toLowerCase() };
  }

  // Check if input looks like just a URL/domain
  const domainOnly = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z.]+)$/i);
  if (domainOnly) {
    const domain = domainOnly[1].toLowerCase();
    const namePart = domain.split(".")[0];
    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    return { name, domain };
  }

  return { name: trimmed };
}

// Convert Date to Attio's expected format (nanosecond precision)
export function toAttioDateFormat(date: Date): string {
  // Attio expects: "2023-01-01T15:00:00.000000000Z" (9 decimal places)
  const iso = date.toISOString(); // "2023-01-01T15:00:00.000Z"
  // Replace .000Z with .000000000Z
  return iso.replace(/\.(\d{3})Z$/, ".$1000000Z");
}

export function parseDeadline(deadline: unknown): string | null {
  if (!deadline) return null;

  // Convert to string if needed
  const deadlineStr = typeof deadline === "string" ? deadline : String(deadline);
  if (!deadlineStr || deadlineStr === "undefined" || deadlineStr === "null") return null;

  const now = new Date();
  const lowerDeadline = deadlineStr.toLowerCase().trim();

  // Handle relative dates first (before trying Date parsing)
  if (lowerDeadline.includes("tomorrow")) {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  if (
    lowerDeadline.includes("next week") ||
    lowerDeadline === "1 week" ||
    lowerDeadline === "a week"
  ) {
    now.setDate(now.getDate() + 7);
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  // Handle "next wednesday", "next monday", etc.
  const dayMatch = lowerDeadline.match(
    /(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
  );
  if (dayMatch) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDay = days.indexOf(dayMatch[1].toLowerCase());
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    now.setDate(now.getDate() + daysUntil);
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  // Handle "in X days" or "X days"
  const daysMatch = lowerDeadline.match(/(?:in\s+)?(\d+)\s*days?/i);
  if (daysMatch) {
    now.setDate(now.getDate() + parseInt(daysMatch[1], 10));
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  // Handle "in X weeks" or "X weeks" (including word numbers like "two weeks")
  const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const weeksMatch = lowerDeadline.match(/(?:in\s+)?(\d+|one|two|three|four|five|six)\s*weeks?/i);
  if (weeksMatch) {
    const weekValue = weeksMatch[1].toLowerCase();
    const weeks = wordToNum[weekValue] || parseInt(weekValue, 10);
    if (!isNaN(weeks)) {
      now.setDate(now.getDate() + weeks * 7);
      now.setHours(9, 0, 0, 0);
      return toAttioDateFormat(now);
    }
  }

  // Handle "end of week", "eow"
  if (lowerDeadline.includes("end of week") || lowerDeadline === "eow") {
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilFriday);
    now.setHours(17, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  // Only try ISO date parsing for strings that look like dates (YYYY-MM-DD format)
  const isoMatch = deadlineStr.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const isoDate = new Date(deadlineStr);
    if (!isNaN(isoDate.getTime())) {
      return toAttioDateFormat(isoDate);
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
  console.log("[TASK] createTask input:", {
    assigneeId: input.assigneeId,
    assigneeIdType: typeof input.assigneeId,
    assigneeIdTruthy: !!input.assigneeId,
  });

  const assignees: Array<{ referenced_actor_type: string; referenced_actor_id: string }> = [];
  if (input.assigneeId) {
    assignees.push({
      referenced_actor_type: "workspace-member",
      referenced_actor_id: input.assigneeId,
    });
  }

  // Parse deadline - Attio requires deadline_at field (can be null)
  const parsedDeadline = parseDeadline(input.deadline);
  console.log("[TASK] Deadline parsing:", {
    input: input.deadline,
    inputType: typeof input.deadline,
    parsed: parsedDeadline,
  });

  const data: Record<string, unknown> = {
    content: input.content,
    format: "plaintext",
    is_completed: false,
    deadline_at: parsedDeadline, // REQUIRED by Attio API - null is valid
    linked_records: linkedRecords,
    assignees: assignees,
  };

  console.log("[TASK] Sending to Attio:", JSON.stringify(data, null, 2));

  try {
    const response = await attioRequest<AttioTaskResponse>("/tasks", apiKey, {
      method: "POST",
      body: JSON.stringify({ data }),
    });

    return {
      success: true,
      recordId: response.data.id.task_id,
      // Attio doesn't return web_url for tasks - will use linked record URL if available
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
    const response = await attioRequest<AttioNoteResponse>("/notes", apiKey, {
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
    });

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

export async function searchRecords(objectSlug: string, query: string): Promise<SearchResult[]> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  // Use the dedicated search endpoint for fuzzy matching on names, domains, emails, etc.
  const response = await attioRequest<{
    data: Array<{
      id: { record_id: string };
      object: { api_slug: string };
      primary_attribute?: { value?: string; full_name?: string };
    }>;
  }>("/objects/records/search", apiKey, {
    method: "POST",
    body: JSON.stringify({
      query,
      objects: [objectSlug],
      request_as: { type: "workspace" },
      limit: 10,
    }),
  });

  return response.data.map((record) => {
    const name =
      record.primary_attribute?.full_name || record.primary_attribute?.value || "Unknown";

    return {
      id: record.id.record_id,
      name,
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
    originalInstruction?: string; // User's raw instruction for date extraction
    callerEmail?: string; // Email of the Telegram user who initiated the action
  },
  messagesContent: string
): Promise<ActionResult> {
  "use step";

  let result: ActionResult;
  let parentObject: "companies" | "people" | "deals" = "companies";
  let parentRecordId: string | undefined;

  // Track created prerequisite records for linking
  const createdRecords: Record<string, string> = {}; // intent -> recordId
  const createdPrerequisites: Array<{ name: string; url?: string }> = [];

  const data = action.extractedData;

  // Execute prerequisite actions first
  console.log("[ACTION] Checking prerequisiteActions:", {
    hasPrereqs: !!action.prerequisiteActions,
    count: action.prerequisiteActions?.length || 0,
    prereqs: action.prerequisiteActions,
  });

  if (action.prerequisiteActions && action.prerequisiteActions.length > 0) {
    console.log("[ACTION] Executing prerequisite actions...");
    for (const prereq of action.prerequisiteActions) {
      let prereqResult: ActionResult | null = null;

      switch (prereq.intent) {
        case "create_company": {
          const companyName = String(prereq.extractedData.name || "");
          console.log("[ACTION] Creating prerequisite company:", companyName);
          prereqResult = await createCompany({
            name: companyName,
            domain: String(prereq.extractedData.domains || prereq.extractedData.domain || ""),
            location: String(prereq.extractedData.primary_location || ""),
          });
          console.log("[ACTION] Company creation result:", prereqResult);
          if (prereqResult.success && prereqResult.recordId) {
            createdRecords["company"] = prereqResult.recordId;
            createdPrerequisites.push({ name: `🏢 ${companyName}`, url: prereqResult.recordUrl });
          }
          break;
        }
        case "create_person": {
          const personName = String(prereq.extractedData.name || "");
          prereqResult = await createPerson({
            name: personName,
            email: String(prereq.extractedData.email || ""),
            company: createdRecords["company"]
              ? undefined
              : String(prereq.extractedData.company || ""),
          });
          if (prereqResult.success && prereqResult.recordId) {
            createdRecords["person"] = prereqResult.recordId;
            createdPrerequisites.push({ name: `👤 ${personName}`, url: prereqResult.recordUrl });
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
      // Use prerequisite company if created, otherwise check associated_company
      let companyForPerson = createdRecords["company"]
        ? undefined
        : String(data.company || data.associated_company || "");

      // If we have a company name but no prerequisite was created, search or create it
      if (companyForPerson && !createdRecords["company"]) {
        const companies = await searchRecords("companies", companyForPerson);
        if (companies.length > 0) {
          // Company exists, use its name for linking
          companyForPerson = companies[0].name;
        } else {
          // Create the company
          const createResult = await createCompany({ name: companyForPerson });
          if (createResult.success && createResult.recordId) {
            createdPrerequisites.push({
              name: companyForPerson,
              url: createResult.recordUrl,
            });
          }
        }
      }

      result = await createPerson({
        name: String(data.name || data.full_name || ""),
        email: String(data.email_addresses || data.email || ""),
        phone: String(data.phone_numbers || data.phone || ""),
        company: companyForPerson,
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
      let companyId = createdRecords["company"];
      let companyName = companyId
        ? undefined
        : String(data.associated_company || data.company || "");

      // If we have a company name but no prerequisite was created, search or create it
      if (companyName && !companyId) {
        const companies = await searchRecords("companies", companyName);
        if (companies.length > 0) {
          companyId = companies[0].id;
          companyName = undefined;
        } else {
          // Create the company
          const createResult = await createCompany({ name: companyName });
          if (createResult.success && createResult.recordId) {
            companyId = createResult.recordId;
            createdPrerequisites.push({
              name: companyName,
              url: createResult.recordUrl,
            });
            companyName = undefined;
          }
        }
      }

      // Owner: use AI-extracted owner if specified, otherwise default to caller
      // Stage: always uses workspace default (set in createDeal)
      const extractedOwner = String(data.owner || data.ownerEmail || data.owner_email || "");
      result = await createDeal({
        name: String(data.name || ""),
        value: value as number | undefined,
        currency: String(currency || "USD"),
        companyName,
        companyId,
        ownerEmail: extractedOwner || action.callerEmail || "",
      });
      parentObject = "deals";
      parentRecordId = result.recordId;
      break;
    }

    case "create_task": {
      // Use prerequisite company/person if created
      let linkedRecordId = String(data.linked_record_id || "");
      let linkedRecordObject = String(data.linked_record_object || "");
      let linkedCompanyUrl: string | undefined;

      if (!linkedRecordId && createdRecords["company"]) {
        linkedRecordId = createdRecords["company"];
        linkedRecordObject = "companies";
        // Get URL from prerequisite if available
        const prereqCompany = createdPrerequisites.find((p) => p.name.startsWith("🏢"));
        if (prereqCompany?.url) {
          linkedCompanyUrl = prereqCompany.url;
        }
      } else if (!linkedRecordId && createdRecords["person"]) {
        linkedRecordId = createdRecords["person"];
        linkedRecordObject = "people";
      }

      // If no linked record yet, check for associated_company
      if (!linkedRecordId) {
        const associatedCompany = String(data.associated_company || data.company || "");
        if (associatedCompany) {
          // Parse company input to extract name and domain (e.g., "Noah from Noah.com")
          const parsed = parseCompanyInput(associatedCompany);

          // Search for the company by name
          const companies = await searchRecords("companies", parsed.name);
          if (companies.length > 0) {
            linkedRecordId = companies[0].id;
            linkedRecordObject = "companies";
            linkedCompanyUrl = await getRecordUrl("companies", companies[0].id);
          } else {
            // Create the company with parsed name and domain
            const createResult = await createCompany({
              name: parsed.name,
              domain: parsed.domain,
            });
            if (createResult.success && createResult.recordId) {
              linkedRecordId = createResult.recordId;
              linkedRecordObject = "companies";
              linkedCompanyUrl = createResult.recordUrl;
              createdPrerequisites.push({
                name: parsed.name,
                url: createResult.recordUrl,
              });
            }
          }
        }
      }

      // Try to extract deadline from original instruction first (AI often computes dates wrong)
      // Our parseDeadline handles "next wednesday", "tomorrow", etc. correctly
      let deadlineValue: unknown = null;
      if (action.originalInstruction) {
        const instructionDeadline = parseDeadline(action.originalInstruction);
        if (instructionDeadline) {
          console.log("[TASK] Extracted deadline from instruction:", instructionDeadline);
          deadlineValue = action.originalInstruction; // Pass raw instruction, parseDeadline will handle it in createTask
        }
      }

      // Fall back to AI's extracted deadline if we couldn't extract from instruction
      if (!deadlineValue) {
        deadlineValue =
          data.deadline_at ||
          data.due_date ||
          data.deadline ||
          (data as Record<string, unknown>)["due date"] ||
          data.due ||
          data.date;
      }

      console.log("[TASK] Input data for task creation:", {
        assignee_id: data.assignee_id,
        assignee_id_type: typeof data.assignee_id,
        assignee: data.assignee,
        assignee_email: data.assignee_email,
        allKeys: Object.keys(data),
      });

      result = await createTask({
        content: String(data.content || data.title || data.task || ""),
        assigneeId: data.assignee_id ? String(data.assignee_id) : undefined,
        assigneeEmail: String(data.assignee_email || data.assignee || ""),
        deadline: deadlineValue,
        linkedRecordId,
        linkedRecordObject,
      });

      // Link to company's tasks tab since Attio doesn't provide direct task URLs
      if (linkedCompanyUrl) {
        result.recordUrl = `${linkedCompanyUrl}/tasks`;
      }

      // Include created prerequisites in task result
      if (createdPrerequisites.length > 0) {
        result.createdPrerequisites = createdPrerequisites;
      }
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

  // Include created prerequisites in result
  if (createdPrerequisites.length > 0) {
    result.createdPrerequisites = createdPrerequisites;
  }

  return result;
}
