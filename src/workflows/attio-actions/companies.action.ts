/**
 * Company operations for Attio CRM.
 */

import { attioRequest, getApiKey, type ActionResult, type AttioRecordResponse } from "./api";

export interface CreateCompanyInput {
  name: string;
  domain?: string;
  location?: string;
  description?: string;
}

export async function createCompany(input: CreateCompanyInput): Promise<ActionResult> {
  const apiKey = getApiKey();

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
