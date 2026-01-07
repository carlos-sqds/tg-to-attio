/**
 * Deal operations for Attio CRM.
 */

import { attioRequest, getApiKey, type ActionResult, type AttioRecordResponse } from "./api";

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

export interface CreateDealInput {
  name: string;
  value?: number;
  currency?: string;
  companyName?: string;
  companyId?: string;
  ownerEmail?: string;
}

export async function createDeal(input: CreateDealInput): Promise<ActionResult> {
  const apiKey = getApiKey();

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
    const searchResponse = await attioRequest<{
      data: Array<{ id: { record_id: string } }>;
    }>("/objects/records/search", apiKey, {
      method: "POST",
      body: JSON.stringify({
        query: input.companyName,
        objects: ["companies"],
        request_as: { type: "workspace" },
        limit: 1,
      }),
    });

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
