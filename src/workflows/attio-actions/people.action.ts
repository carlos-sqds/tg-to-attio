/**
 * Person/People operations for Attio CRM.
 */

import { attioRequest, getApiKey, type ActionResult, type AttioRecordResponse } from "./api";

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
  const apiKey = getApiKey();

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
