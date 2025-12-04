export const config = {
  botToken: process.env.BOT_TOKEN || "",
  attioApiKey: process.env.ATTIO_API_KEY || "",
  nodeEnv: process.env.NODE_ENV || "development",
  
  attio: {
    baseUrl: "https://api.attio.com/v2",
    companiesObject: "companies",
  },
  
  conversation: {
    timeoutMinutes: 5,
    maxSearchResults: 5,
  },
} as const;

export function validateConfig() {
  const required = {
    BOT_TOKEN: config.botToken,
    ATTIO_API_KEY: config.attioApiKey,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
