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

User clarified the "${clarificationField}" field with: "${userResponse}"

Update the suggested action with this clarification and remove it from clarificationsNeeded.`;

  const { object } = await generateObject({
    model: gateway(DEFAULT_MODEL),
    schema: SuggestedActionSchema,
    system: buildSystemPrompt(schema),
    prompt,
  });

  return object;
}
