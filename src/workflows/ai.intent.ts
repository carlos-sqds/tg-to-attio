import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import {
  SuggestedActionSchema,
  type SuggestedAction,
  type AIContext,
  type WorkspaceMember,
} from "@/src/services/attio/schema-types";
import { buildSystemPrompt, buildUserPrompt } from "@/src/ai/prompts";
import type { CallerInfo } from "@/src/lib/types/session.types";

const DEFAULT_MODEL = "anthropic/claude-3-5-sonnet-20241022";
const CHEAP_MODEL = "google/gemini-2.0-flash-lite";

/**
 * Analyze user intent from forwarded messages and instruction.
 * Uses Vercel AI Gateway with Claude.
 */
export async function analyzeIntent(context: AIContext): Promise<SuggestedAction> {
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
 * Process clarification response and update suggested action.
 * Understands additional instructions like "create if needed".
 */
export async function processClarification(
  previousAction: SuggestedAction,
  clarificationField: string,
  userResponse: string,
  schema: AIContext["schema"]
): Promise<SuggestedAction> {
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

/**
 * Resolved assignee with member details.
 */
export interface ResolvedAssignee {
  memberId: string;
  memberName: string;
  email: string;
}

/**
 * Resolve an assignee name to a workspace member using LLM fuzzy matching.
 * Uses a cheap model (gemini-2.0-flash-lite) for cost efficiency.
 *
 * @param assigneeName - The name to match (can be partial, nickname, "me", etc.)
 * @param callerInfo - Info about the Telegram user who called /done (used when assigneeName is "me" or empty)
 * @param workspaceMembers - List of workspace members to match against
 * @param defaultToCaller - If true and assigneeName is empty, default to caller
 */
export async function resolveAssignee(
  assigneeName: string,
  callerInfo: CallerInfo | null,
  workspaceMembers: WorkspaceMember[],
  defaultToCaller: boolean = true
): Promise<ResolvedAssignee | null> {
  if (workspaceMembers.length === 0) {
    return null;
  }

  // Determine what name to search for
  let searchName = assigneeName.trim();

  // Handle "me" - use caller's info
  if (searchName.toLowerCase() === "me" && callerInfo) {
    searchName = [callerInfo.firstName, callerInfo.lastName].filter(Boolean).join(" ");
    if (!searchName && callerInfo.username) {
      searchName = callerInfo.username;
    }
  }

  // Handle empty - default to caller if enabled
  if (!searchName && defaultToCaller && callerInfo) {
    searchName = [callerInfo.firstName, callerInfo.lastName].filter(Boolean).join(" ");
    if (!searchName && callerInfo.username) {
      searchName = callerInfo.username;
    }
  }

  // Still no name to search for
  if (!searchName) {
    return null;
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.warn("[RESOLVE_ASSIGNEE] AI_GATEWAY_API_KEY not configured");
    return null;
  }

  const memberList = workspaceMembers
    .map((m) => `- ID: "${m.id}" | Name: "${m.firstName} ${m.lastName}" | Email: "${m.email}"`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: gateway(CHEAP_MODEL),
      schema: z.object({
        matchedMemberId: z
          .string()
          .nullable()
          .describe("The ID of the matched member, or null if no match"),
        confidence: z
          .enum(["high", "medium", "low", "none"])
          .describe("Confidence level of the match"),
      }),
      prompt: `Match the name "${searchName}" to one of these workspace members:

${memberList}

Rules:
- Match by first name, last name, full name, email prefix, or reasonable nickname
- "Carlos" matches "Carlos Noriega", "Sarah" matches "Sarah Johnson"
- Username like "cnoriega" could match "Carlos Noriega"
- Return the member ID if there's a reasonable match
- Return null if no reasonable match exists
- Set confidence: "high" for exact/obvious matches, "medium" for partial matches, "low" for uncertain, "none" if no match`,
    });

    console.log("[RESOLVE_ASSIGNEE] LLM result:", { searchName, result: object });

    if (object.matchedMemberId && object.confidence !== "none") {
      const member = workspaceMembers.find((m) => m.id === object.matchedMemberId);
      if (member) {
        return {
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`,
          email: member.email,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[RESOLVE_ASSIGNEE] Error:", error);
    return null;
  }
}
