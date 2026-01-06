import type { ActionResult } from "@/src/services/attio/schema-types";
import type { SearchResult } from "@/src/lib/types/session.types";

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

// Cache for valid deal stages
let dealStagesCache: string[] | null = null;

export function clearDealStagesCache(): void {
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

// ============ PERSON OPERATIONS ============

export interface CreatePersonInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  companyId?: string;
  jobTitle?: string;
  description?: string;
}

export async function createPerson(input: CreatePersonInput): Promise<ActionResult> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const values: Record<string, unknown> = {};

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
}

export async function createDeal(input: CreateDealInput): Promise<ActionResult> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const values: Record<string, unknown> = {
    name: input.name,
  };

  if (input.value !== undefined) {
    values.value = input.value;
  }

  const validStages = await getValidDealStages(apiKey);
  if (validStages.length > 0) {
    values.stage = validStages[0];
  }

  if (input.companyId) {
    values.associated_company = {
      target_object: "companies",
      target_record_id: input.companyId,
    };
  } else if (input.companyName) {
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
  deadline?: unknown;
  linkedRecordId?: string;
  linkedRecordObject?: string;
}

export function parseCompanyInput(input: string): { name: string; domain?: string } {
  const trimmed = input.trim();

  const fromPattern = trimmed.match(/^(.+?)\s+from\s+(\S+\.\S+)$/i);
  if (fromPattern) {
    return { name: fromPattern[1].trim(), domain: fromPattern[2].toLowerCase() };
  }

  const parenPattern = trimmed.match(/^(.+?)\s*\((\S+\.\S+)\)$/);
  if (parenPattern) {
    return { name: parenPattern[1].trim(), domain: parenPattern[2].toLowerCase() };
  }

  const domainOnly = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z.]+)$/i);
  if (domainOnly) {
    const domain = domainOnly[1].toLowerCase();
    const namePart = domain.split(".")[0];
    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    return { name, domain };
  }

  return { name: trimmed };
}

export function toAttioDateFormat(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/\.(\d{3})Z$/, ".$1000000Z");
}

export function parseDeadline(deadline: unknown): string | null {
  if (!deadline) return null;

  const deadlineStr = typeof deadline === "string" ? deadline : String(deadline);
  if (!deadlineStr || deadlineStr === "undefined" || deadlineStr === "null") return null;

  const now = new Date();
  const lowerDeadline = deadlineStr.toLowerCase().trim();

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

  const daysMatch = lowerDeadline.match(/(?:in\s+)?(\d+)\s*days?/i);
  if (daysMatch) {
    now.setDate(now.getDate() + parseInt(daysMatch[1], 10));
    now.setHours(9, 0, 0, 0);
    return toAttioDateFormat(now);
  }

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

  if (lowerDeadline.includes("end of week") || lowerDeadline === "eow") {
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilFriday);
    now.setHours(17, 0, 0, 0);
    return toAttioDateFormat(now);
  }

  const isoMatch = deadlineStr.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const isoDate = new Date(deadlineStr);
    if (!isNaN(isoDate.getTime())) {
      return toAttioDateFormat(isoDate);
    }
  }

  return null;
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const linkedRecords: Array<{ target_object: string; target_record_id: string }> = [];
  if (input.linkedRecordId && input.linkedRecordObject) {
    linkedRecords.push({
      target_object: input.linkedRecordObject,
      target_record_id: input.linkedRecordId,
    });
  }

  const assignees: Array<{ referenced_actor_type: string; referenced_actor_id: string }> = [];
  if (input.assigneeId) {
    assignees.push({
      referenced_actor_type: "workspace-member",
      referenced_actor_id: input.assigneeId,
    });
  }

  const parsedDeadline = parseDeadline(input.deadline);

  const data: Record<string, unknown> = {
    content: input.content,
    format: "plaintext",
    is_completed: false,
    deadline_at: parsedDeadline,
    linked_records: linkedRecords,
    assignees: assignees,
  };

  try {
    const response = await attioRequest<AttioTaskResponse>("/tasks", apiKey, {
      method: "POST",
      body: JSON.stringify({ data }),
    });

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

export async function searchRecords(objectSlug: string, query: string): Promise<SearchResult[]> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const response = await attioRequest<{
    data: Array<{
      id: { record_id: string };
      object_slug: string;
      record_text: string;
      domains?: string[];
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

  return response.data.map((record) => ({
    id: record.id.record_id,
    name: record.record_text || "Unknown",
    extra: record.domains?.[0],
  }));
}

// ============ COMPOSITE OPERATIONS ============

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
    originalInstruction?: string;
    callerEmail?: string;
  },
  messagesContent: string
): Promise<ActionResult> {
  let result: ActionResult;
  let parentObject: "companies" | "people" | "deals" = "companies";
  let parentRecordId: string | undefined;

  const createdRecords: Record<string, string> = {};
  const createdPrerequisites: Array<{ name: string; url?: string }> = [];

  const data = action.extractedData;

  // Execute prerequisite actions first
  if (action.prerequisiteActions && action.prerequisiteActions.length > 0) {
    for (const prereq of action.prerequisiteActions) {
      let prereqResult: ActionResult | null = null;

      switch (prereq.intent) {
        case "create_company": {
          const companyName = String(prereq.extractedData.name || "");
          if (companyName) {
            const existingCompanies = await searchRecords("companies", companyName);
            if (existingCompanies.length > 0) {
              createdRecords["company"] = existingCompanies[0].id;
              prereqResult = { success: true, recordId: existingCompanies[0].id };
            } else {
              prereqResult = await createCompany({
                name: companyName,
                domain: String(prereq.extractedData.domains || prereq.extractedData.domain || ""),
                location: String(prereq.extractedData.primary_location || ""),
              });
              if (prereqResult.success && prereqResult.recordId) {
                createdRecords["company"] = prereqResult.recordId;
                createdPrerequisites.push({
                  name: `🏢 ${companyName}`,
                  url: prereqResult.recordUrl,
                });
              }
            }
          }
          break;
        }
        case "create_person": {
          const personName = String(prereq.extractedData.name || "");
          prereqResult = await createPerson({
            name: personName,
            email: String(prereq.extractedData.email || ""),
            companyId: createdRecords["company"],
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
      let companyIdForPerson = createdRecords["company"];
      const companyNameFromData = String(data.company || data.associated_company || "");

      if (!companyIdForPerson && companyNameFromData) {
        const companies = await searchRecords("companies", companyNameFromData);
        if (companies.length > 0) {
          companyIdForPerson = companies[0].id;
        } else {
          const createResult = await createCompany({ name: companyNameFromData });
          if (createResult.success && createResult.recordId) {
            companyIdForPerson = createResult.recordId;
            createdPrerequisites.push({
              name: companyNameFromData,
              url: createResult.recordUrl,
            });
          }
        }
      }

      result = await createPerson({
        name: String(data.name || data.full_name || ""),
        email: String(data.email_addresses || data.email || ""),
        phone: String(data.phone_numbers || data.phone || ""),
        companyId: companyIdForPerson,
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

      let companyId = createdRecords["company"];
      let companyName = companyId
        ? undefined
        : String(data.associated_company || data.company || "");

      if (companyName && !companyId) {
        const companies = await searchRecords("companies", companyName);
        if (companies.length > 0) {
          companyId = companies[0].id;
          companyName = undefined;
        } else {
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

      const extractedOwner = String(data.owner || data.ownerEmail || data.owner_email || "");
      result = await createDeal({
        name: String(data.name || ""),
        value: value as number | undefined,
        currency: "USD",
        companyName,
        companyId,
        ownerEmail: extractedOwner || action.callerEmail || "",
      });
      parentObject = "deals";
      parentRecordId = result.recordId;
      break;
    }

    case "create_task": {
      let linkedRecordId = String(data.linked_record_id || "");
      let linkedRecordObject = String(data.linked_record_object || "");
      let linkedCompanyUrl: string | undefined;

      if (!linkedRecordId && createdRecords["company"]) {
        linkedRecordId = createdRecords["company"];
        linkedRecordObject = "companies";
        const prereqCompany = createdPrerequisites.find((p) => p.name.startsWith("🏢"));
        if (prereqCompany?.url) {
          linkedCompanyUrl = prereqCompany.url;
        }
      } else if (!linkedRecordId && createdRecords["person"]) {
        linkedRecordId = createdRecords["person"];
        linkedRecordObject = "people";
      }

      if (!linkedRecordId) {
        const associatedCompany = String(data.associated_company || data.company || "");
        if (associatedCompany) {
          const parsed = parseCompanyInput(associatedCompany);
          const companies = await searchRecords("companies", parsed.name);
          if (companies.length > 0) {
            linkedRecordId = companies[0].id;
            linkedRecordObject = "companies";
            linkedCompanyUrl = await getRecordUrl("companies", companies[0].id);
          } else {
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

      let deadlineValue: unknown = null;
      if (action.originalInstruction) {
        const instructionDeadline = parseDeadline(action.originalInstruction);
        if (instructionDeadline) {
          deadlineValue = action.originalInstruction;
        }
      }

      if (!deadlineValue) {
        deadlineValue =
          data.deadline_at ||
          data.due_date ||
          data.deadline ||
          (data as Record<string, unknown>)["due date"] ||
          data.due ||
          data.date;
      }

      result = await createTask({
        content: String(data.content || data.title || data.task || ""),
        assigneeId: data.assignee_id ? String(data.assignee_id) : undefined,
        assigneeEmail: String(data.assignee_email || data.assignee || ""),
        deadline: deadlineValue,
        linkedRecordId,
        linkedRecordObject,
      });

      if (linkedCompanyUrl) {
        result.recordUrl = `${linkedCompanyUrl}/tasks`;
      }

      if (createdPrerequisites.length > 0) {
        result.createdPrerequisites = createdPrerequisites;
      }
      return result;
    }

    case "add_note": {
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

  if (createdPrerequisites.length > 0) {
    result.createdPrerequisites = createdPrerequisites;
  }

  return result;
}
