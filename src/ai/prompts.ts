import type { AttioSchema, ObjectDefinition, ListDefinition } from "@/src/services/attio/schema-types";

function formatObjectSchema(obj: ObjectDefinition): string {
  const writableAttrs = obj.attributes
    .filter((a) => a.isWritable && !a.isArchived)
    .map((a) => {
      let desc = `  - ${a.apiSlug} (${a.type})`;
      if (a.isRequired) desc += " [REQUIRED]";
      if (a.description) desc += `: ${a.description}`;
      return desc;
    })
    .join("\n");

  return `${obj.singularNoun} (${obj.apiSlug}):\n${writableAttrs}`;
}

function formatListSchema(list: ListDefinition): string {
  return `- ${list.name} (${list.apiSlug}): for ${list.parentObject} records`;
}

function formatWorkspaceMembers(schema: AttioSchema): string {
  return schema.workspaceMembers
    .map((m) => `- ${m.firstName} ${m.lastName} (${m.email})`)
    .join("\n");
}

export function buildSystemPrompt(schema: AttioSchema): string {
  const objectSchemas = schema.objects
    .map(formatObjectSchema)
    .join("\n\n");

  const listSchemas = schema.lists
    .map(formatListSchema)
    .join("\n");

  const members = formatWorkspaceMembers(schema);

  return `You are an AI assistant that helps manage a CRM (Attio). Your job is to analyze forwarded Telegram messages and user instructions to determine what CRM action to take.

## Available Objects and Their Fields

${objectSchemas}

## Available Lists

${listSchemas}

## Team Members (for task assignment)

${members}

## Your Task

Analyze the provided messages and instruction to:
1. Determine the correct action intent
2. Extract relevant data from the messages
3. Identify any missing required fields
4. Flag any ambiguities that need user clarification

## Guidelines

IMPORTANT: ALL records (people, deals, tasks) MUST be linked to a company.
- Always try to infer the company from context (chat name, mentioned companies, sender info, email domain)
- If a company is inferred but may not exist, add it as a prerequisiteAction with intent "create_company"
- If no company can be inferred at all, add a clarification asking which company the record should be linked to
- Always include "associated_company" field in extractedData for people, deals, and tasks

- For "create_person": 
  - Extract name, email, phone from messages
  - associated_company: Company name (REQUIRED - infer from email domain, chat name, or context)
  
- For "create_company": Extract company name, domain, location

- For "create_deal": 
  - Extract deal name, value
  - associated_company: Company name (REQUIRED - infer from context)
  
- For "create_task":
  - content: The task description (required)
  - deadline_at: Pass the deadline EXACTLY as mentioned (e.g., "next wednesday", "tomorrow", "2025-12-15"). Do NOT compute dates - just pass the exact text.
  - assignee_email: Email of person to assign
  - associated_company: Company name (REQUIRED - infer from context)

- For "add_to_list": Identify which list and which record
- For "add_note": Identify the parent record (company/person)

When extracting data:
- Look for email patterns (xxx@xxx.com)
- Look for phone patterns
- Look for company names mentioned
- Look for monetary values ($X, Xk, etc.)
- Look for dates and deadlines
- Look for names (first/last)

If multiple companies or people match, set clarificationsNeeded with the ambiguous field.
If a required field is missing and cannot be inferred, add it to missingRequired.

## Prerequisite Actions

When the user mentions creating dependent records (e.g., "create company if doesn't exist"), use the prerequisiteActions array:
- If creating a person linked to a company that doesn't exist, add create_company as prerequisite
- If creating a task about a company that should be created, add create_company as prerequisite
- Example: "create task for Iron company - create Iron if needed" → prerequisiteActions: [{intent: "create_company", extractedData: {name: "Iron"}, reason: "User requested company creation"}]

The prerequisite actions will be executed BEFORE the main action, and their IDs will be used to link records.

## Important: Note Creation

The forwarded messages will ALWAYS be saved as a note attached to the created/referenced record.
Generate a descriptive "noteTitle" that summarizes the conversation content.
Examples:
- "Initial conversation with John Smith from Acme Corp"
- "Sales discussion - TechCorp enterprise deal"
- "Follow-up call notes - Project timeline"

Be concise in your reasoning but thorough in extraction.`;
}

export function buildUserPrompt(
  messages: Array<{
    text: string;
    senderUsername?: string;
    senderFirstName?: string;
    senderLastName?: string;
    chatName: string;
    date: number;
  }>,
  instruction: string
): string {
  const formattedMessages = messages
    .map((m, i) => {
      const sender = m.senderUsername
        ? `@${m.senderUsername}`
        : [m.senderFirstName, m.senderLastName].filter(Boolean).join(" ") || "Unknown";
      const date = new Date(m.date * 1000).toLocaleString();
      return `[Message ${i + 1}] From: ${sender} (${m.chatName}) at ${date}\n${m.text}`;
    })
    .join("\n\n");

  const messagesSection = messages.length > 0
    ? `## Forwarded Messages\n\n${formattedMessages}`
    : "## No forwarded messages provided";

  return `${messagesSection}

## User Instruction

${instruction}

Analyze the above and determine the appropriate CRM action.`;
}
