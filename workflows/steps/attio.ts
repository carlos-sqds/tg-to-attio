import { config } from "@/src/lib/config";
import { logger } from "@/src/lib/logger";
import type {
  AttioCompany,
  AttioNote,
  CreateNoteInput,
  SearchCompaniesInput,
  CompanySearchResult,
} from "@/src/services/attio/types";

const ATTIO_BASE_URL = "https://api.attio.com/v2";

async function attioRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ATTIO_BASE_URL}${endpoint}`;
  
  console.log("[ATTIO_REQUEST] Starting request to:", endpoint);
  console.log("[ATTIO_REQUEST] API key exists:", !!config.attioApiKey);

  const headers = {
    Authorization: `Bearer ${config.attioApiKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log("[ATTIO_REQUEST] Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[ATTIO_REQUEST] Error response:", response.status, errorBody);
      throw new Error(`Attio API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    console.error("[ATTIO_REQUEST] Fetch error:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  "use step";

  console.log("[ATTIO] searchCompanies called with query:", query);
  console.log("[ATTIO] API key present:", !!config.attioApiKey);
  console.log("[ATTIO] API key prefix:", config.attioApiKey?.substring(0, 8) || "MISSING");

  const searchInput: SearchCompaniesInput = {
    filter: {
      name: {
        $contains: query,
      },
    },
    limit: config.conversation.maxSearchResults + 5,
  };

  console.log("[ATTIO] Search input:", JSON.stringify(searchInput));

  try {
    const response = await attioRequest<{ data: AttioCompany[] }>(
      `/objects/${config.attio.companiesObject}/records/query`,
      {
        method: "POST",
        body: JSON.stringify(searchInput),
      }
    );

    console.log("[ATTIO] Response received, company count:", response.data?.length || 0);

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

    console.log("[ATTIO] Returning results:", results.length);
    return results;
  } catch (error) {
    console.error("[ATTIO] Search error:", error instanceof Error ? error.message : String(error));
    throw error;
  }
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
