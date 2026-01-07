/**
 * Prerequisite action execution for Attio CRM.
 * Handles creating prerequisite records (companies, people) before main actions.
 */

import type { ActionResult } from "@/src/services/attio/schema-types";
import { AttioIntent } from "@/src/lib/types/intent.types";
import { createCompany } from "./companies.action";
import { createPerson } from "./people.action";
import { searchRecords } from "./search.action";

export interface PrerequisiteAction {
  intent: string;
  extractedData: Record<string, unknown>;
}

export interface PrerequisiteResult {
  success: boolean;
  error?: string;
  createdRecords: Record<string, string>;
  createdPrerequisites: Array<{ name: string; url?: string }>;
}

export async function executePrerequisites(
  prerequisiteActions: PrerequisiteAction[]
): Promise<PrerequisiteResult> {
  const createdRecords: Record<string, string> = {};
  const createdPrerequisites: Array<{ name: string; url?: string }> = [];

  for (const prereq of prerequisiteActions) {
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
        createdRecords,
        createdPrerequisites,
      };
    }
  }

  return { success: true, createdRecords, createdPrerequisites };
}
