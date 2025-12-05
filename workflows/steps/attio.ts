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
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ATTIO_BASE_URL}${endpoint}`;
  
  console.log("[ATTIO_REQUEST] Starting request to:", endpoint);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
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

  // Access env vars directly inside step function
  const apiKey = process.env.ATTIO_API_KEY;
  
  console.log("[ATTIO] searchCompanies called with query:", query);
  console.log("[ATTIO] API key present:", !!apiKey);
  console.log("[ATTIO] API key prefix:", apiKey?.substring(0, 8) || "MISSING");

  if (!apiKey) {
    throw new Error("ATTIO_API_KEY not configured");
  }

  const searchInput: SearchCompaniesInput = {
    filter: {
      name: {
        value: {
          $contains: query,
        },
      },
    },
    limit: 10,
  };

  console.log("[ATTIO] Search input:", JSON.stringify(searchInput));

  try {
    const response = await attioRequest<{ data: AttioCompany[] }>(
      "/objects/companies/records/query",
      apiKey,
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

  // Access env vars directly inside step function
  const apiKey = process.env.ATTIO_API_KEY;
  
  console.log("[ATTIO] Creating note for:", input.parent_record_id);

  if (!apiKey) {
    throw new Error("ATTIO_API_KEY not configured");
  }

  const response = await attioRequest<{ data: AttioNote }>(
    "/notes",
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({
        data: input,
      }),
    }
  );

  console.log("[ATTIO] Note created:", response.data.id.note_id);

  return response.data;
}
