import { config } from "dotenv";
config({ path: ".env" });

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const schema = z.object({
  intent: z.string(),
  message: z.string(),
});

async function test() {
  const model = "anthropic/claude-3-5-sonnet-20241022";
  console.log("Testing model:", model);
  console.log("API Key present:", !!process.env.AI_GATEWAY_API_KEY);
  
  try {
    const { object } = await generateObject({
      model: gateway(model),
      schema,
      prompt: "Say hello and identify your intent as 'greeting'",
    });
    console.log("SUCCESS:", object);
  } catch (error: any) {
    console.log("ERROR:", error.message || error);
  }
}

test();
