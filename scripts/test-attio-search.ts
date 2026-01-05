import { config } from "dotenv";
config({ override: true });

const ATTIO_BASE_URL = "https://api.attio.com/v2";

async function testSearch(query: string) {
  const apiKey = process.env.ATTIO_API_KEY;

  if (!apiKey) {
    console.error("ATTIO_API_KEY not set");
    process.exit(1);
  }

  console.log("Searching for:", query);

  const response = await fetch(`${ATTIO_BASE_URL}/objects/companies/records/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        name: {
          $contains: query,
        },
      },
      limit: 10,
    }),
  });

  console.log("Status:", response.status);
  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

testSearch(process.argv[2] || "lightspark");
