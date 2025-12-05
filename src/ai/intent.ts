import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import {
  SuggestedActionSchema,
  type SuggestedAction,
  type AIContext,
} from "@/src/services/attio/schema-types";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";

const DEFAULT_MODEL = "moonshotai/kimi-k2-thinking";

export interface AnalyzeIntentOptions {
  model?: string;
}

/**
 * Local version for testing - no "use step" directive
 * Can be called directly without Vercel workflow runtime
 */
export async function analyzeIntentLocal(
  context: AIContext,
  options: AnalyzeIntentOptions = {}
): Promise<SuggestedAction> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY not configured");
  }

  const model = options.model || DEFAULT_MODEL;

  const { object } = await generateObject({
    model: gateway(model),
    schema: SuggestedActionSchema,
    system: buildSystemPrompt(context.schema),
    prompt: buildUserPrompt(context.messages, context.instruction),
  });

  return object;
}

/**
 * Simplified intent analysis for when schema is not available
 * Uses a minimal schema assumption
 */
export async function analyzeIntentSimple(
  messages: Array<{
    text: string;
    chatName: string;
    date: number;
    senderUsername?: string;
    senderFirstName?: string;
    senderLastName?: string;
  }>,
  instruction: string,
  options: AnalyzeIntentOptions = {}
): Promise<SuggestedAction> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY not configured");
  }

  const model = options.model || DEFAULT_MODEL;

  const minimalSchema = {
    objects: [
      {
        workspaceId: "",
        objectId: "",
        apiSlug: "people",
        singularNoun: "Person",
        pluralNoun: "People",
        createdAt: "",
        attributes: [
          { id: "1", apiSlug: "name", title: "Name", type: "personal-name" as const, isRequired: true, isWritable: true, isUnique: false, isArchived: false },
          { id: "2", apiSlug: "email_addresses", title: "Email", type: "email-addresses" as const, isRequired: false, isWritable: true, isUnique: false, isArchived: false },
          { id: "3", apiSlug: "phone_numbers", title: "Phone", type: "phone-numbers" as const, isRequired: false, isWritable: true, isUnique: false, isArchived: false },
        ],
      },
      {
        workspaceId: "",
        objectId: "",
        apiSlug: "companies",
        singularNoun: "Company",
        pluralNoun: "Companies",
        createdAt: "",
        attributes: [
          { id: "1", apiSlug: "name", title: "Name", type: "text" as const, isRequired: true, isWritable: true, isUnique: false, isArchived: false },
          { id: "2", apiSlug: "domains", title: "Domain", type: "domain" as const, isRequired: false, isWritable: true, isUnique: false, isArchived: false },
        ],
      },
      {
        workspaceId: "",
        objectId: "",
        apiSlug: "deals",
        singularNoun: "Deal",
        pluralNoun: "Deals",
        createdAt: "",
        attributes: [
          { id: "1", apiSlug: "name", title: "Name", type: "text" as const, isRequired: true, isWritable: true, isUnique: false, isArchived: false },
          { id: "2", apiSlug: "value", title: "Value", type: "currency" as const, isRequired: false, isWritable: true, isUnique: false, isArchived: false },
        ],
      },
    ],
    lists: [],
    workspaceMembers: [],
    lastFetched: Date.now(),
  };

  const { object } = await generateObject({
    model: gateway(model),
    schema: SuggestedActionSchema,
    system: buildSystemPrompt(minimalSchema),
    prompt: buildUserPrompt(messages, instruction),
  });

  return object;
}

/**
 * Workflow step version - for use in Vercel workflows
 * This will be called from workflows/steps/ai.ts
 */
export function createAnalyzeIntentStep() {
  return async function analyzeIntent(context: AIContext): Promise<SuggestedAction> {
    "use step";
    return analyzeIntentLocal(context);
  };
}
