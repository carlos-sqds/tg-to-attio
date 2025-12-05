import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import {
  SuggestedActionSchema,
  type SuggestedAction,
  type AIContext,
} from "@/src/services/attio/schema-types";
import { buildSystemPrompt, buildUserPrompt } from "@/src/ai/prompts";

const DEFAULT_MODEL = "anthropic/claude-3-5-sonnet-20241022";

/**
 * Workflow step for analyzing user intent
 * Uses Vercel AI Gateway with Claude Opus 4.5
 */
export async function analyzeIntent(context: AIContext): Promise<SuggestedAction> {
  "use step";

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY not configured");
  }

  const { object } = await generateObject({
    model: gateway(DEFAULT_MODEL),
    schema: SuggestedActionSchema,
    system: buildSystemPrompt(context.schema),
    prompt: buildUserPrompt(context.messages, context.instruction),
  });

  return object;
}

/**
 * Workflow step for handling clarification responses
 * Takes user's clarification and updates the suggested action
 * Understands additional instructions like "create if needed"
 */
export async function processClarification(
  previousAction: SuggestedAction,
  clarificationField: string,
  userResponse: string,
  schema: AIContext["schema"]
): Promise<SuggestedAction> {
  "use step";

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY not configured");
  }

  const prompt = `Previous suggested action:
${JSON.stringify(previousAction, null, 2)}

User response for "${clarificationField}" field: "${userResponse}"

IMPORTANT: The user's response may contain:
1. A simple value (e.g., "john@example.com")
2. A value with additional instructions (e.g., "TechCorp - create company if it doesn't exist")
3. Instructions to change the action type (e.g., "actually, create a deal instead")
4. Multiple pieces of information (e.g., "Sarah Johnson, CEO at TechCorp")

Interpret the user's intent and update the suggested action accordingly:
- If they mention creating something that doesn't exist, add a clarification asking if they want to create it first
- If they provide additional data, incorporate it into extractedData
- If they want to change the action type, update the intent
- Remove the clarification for "${clarificationField}" from clarificationsNeeded if it's been answered
- Keep other pending clarifications`;

  const { object } = await generateObject({
    model: gateway(DEFAULT_MODEL),
    schema: SuggestedActionSchema,
    system: buildSystemPrompt(schema),
    prompt,
  });

  return object;
}
