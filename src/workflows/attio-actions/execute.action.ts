/**
 * Composite action execution for Attio CRM.
 * Orchestrates individual actions with note attachment and prerequisite handling.
 */

import type { ActionResult } from "@/src/services/attio/schema-types";
import { AttioIntent } from "@/src/lib/types/intent.types";
import { getRecordUrl } from "./api";
import { createCompany } from "./companies.action";
import { createPerson } from "./people.action";
import { createDeal } from "./deals.action";
import { createTask, parseCompanyInput, parseDeadline } from "./tasks.action";
import { createNote } from "./notes.action";
import { addToList } from "./lists.action";
import { searchRecords } from "./search.action";

export interface ExecuteActionInput {
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
}

export async function executeActionWithNote(
  action: ExecuteActionInput,
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
        case AttioIntent.CREATE_COMPANY: {
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
        case AttioIntent.CREATE_PERSON: {
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
    case AttioIntent.CREATE_PERSON: {
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

    case AttioIntent.CREATE_COMPANY: {
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

    case AttioIntent.CREATE_DEAL: {
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

    case AttioIntent.CREATE_TASK: {
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

    case AttioIntent.ADD_NOTE: {
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

    case AttioIntent.ADD_TO_LIST: {
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
