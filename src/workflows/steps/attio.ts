import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import type {
  AttioCompany,
  AttioNote,
  CreateNoteInput,
  SearchCompaniesInput,
  CompanySearchResult,
} from "../../services/attio/types.js";

const ATTIO_BASE_URL = "https://api.attio.com/v2";

async function attioRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ATTIO_BASE_URL}${endpoint}`;

  const headers = {
    Authorization: `Bearer ${config.attioApiKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Attio API error", {
      endpoint,
      status: response.status,
      body: errorBody,
    });
    throw new Error(`Attio API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  "use step";

  const searchInput: SearchCompaniesInput = {
    filter: {
      name: {
        $contains: query,
      },
    },
    limit: config.conversation.maxSearchResults + 5,
  };

  logger.info("Searching companies", { query });

  const response = await attioRequest<{ data: AttioCompany[] }>(
    `/objects/${config.attio.companiesObject}/records/query`,
    {
      method: "POST",
      body: JSON.stringify(searchInput),
    }
  );

  const results: CompanySearchResult[] = response.data.map((company) => {
    const name = company.values.name?.[0]?.value || "Unnamed Company";

    let location: string | undefined;
    const locationData = company.values.locations?.[0];
    if (locationData) {
      const parts = [
        locationData.locality,
        locationData.region,
        locationData.country,
      ].filter(Boolean);
      location = parts.length > 0 ? parts.join(", ") : undefined;
    }

    return {
      id: company.id.record_id,
      name,
      location,
    };
  });

  logger.info("Company search results", { query, count: results.length });
  return results;
}

export async function createNote(input: CreateNoteInput): Promise<AttioNote> {
  "use step";

  logger.info("Creating note", {
    parentObject: input.parent_object,
    parentRecordId: input.parent_record_id,
    title: input.title,
  });

  const response = await attioRequest<{ data: AttioNote }>("/notes", {
    method: "POST",
    body: JSON.stringify({
      data: input,
    }),
  });

  logger.info("Note created successfully", {
    noteId: response.data.id.note_id,
  });

  return response.data;
}
