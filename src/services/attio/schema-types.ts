import { z } from "zod";

// Attribute types supported by Attio
export type AttributeType =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "checkbox"
  | "select"
  | "status"
  | "rating"
  | "actor-reference"
  | "record-reference"
  | "personal-name"
  | "email-addresses"
  | "phone-numbers"
  | "domain"
  | "location"
  | "interaction";

export interface SelectOption {
  id: string;
  title: string;
  isArchived?: boolean;
}

export interface StatusOption {
  id: string;
  title: string;
  isArchived?: boolean;
  targetObjectId?: string;
}

export interface AttributeDefinition {
  id: string;
  apiSlug: string;
  title: string;
  description?: string;
  type: AttributeType;
  isRequired: boolean;
  isWritable: boolean;
  isUnique: boolean;
  isArchived: boolean;
  isMultiselect?: boolean;
  config?: {
    selectOptions?: SelectOption[];
    statusOptions?: StatusOption[];
    referencedObjectId?: string;
    currencyCode?: string;
  };
}

export interface ObjectDefinition {
  workspaceId: string;
  objectId: string;
  apiSlug: string;
  singularNoun: string;
  pluralNoun: string;
  createdAt: string;
  attributes: AttributeDefinition[];
}

export interface ListDefinition {
  id: string;
  apiSlug: string;
  name: string;
  parentObject: string;
  parentObjectId: string;
  createdAt: string;
  attributes: AttributeDefinition[];
  workspaceMemberAccess: string;
}

export interface WorkspaceMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  accessLevel: string;
  createdAt: string;
}

export interface AttioSchema {
  objects: ObjectDefinition[];
  lists: ListDefinition[];
  workspaceMembers: WorkspaceMember[];
  lastFetched: number;
}

// Zod schemas for AI structured output
export const ActionIntentSchema = z.enum([
  "create_person",
  "create_company",
  "create_deal",
  "add_to_list",
  "create_task",
  "add_note",
  "update_record",
  "search_record",
]);

export type ActionIntent = z.infer<typeof ActionIntentSchema>;

export const ClarificationSchema = z.object({
  field: z.string().describe("The field that needs clarification"),
  question: z.string().describe("The question to ask the user"),
  options: z.array(z.string()).optional().describe("Suggested options if available"),
  reason: z.enum(["missing", "ambiguous", "multiple_matches", "not_found"]).describe("Why clarification is needed"),
});

export type Clarification = z.infer<typeof ClarificationSchema>;

export const PrerequisiteActionSchema = z.object({
  intent: ActionIntentSchema.describe("The type of prerequisite action"),
  extractedData: z.record(z.any()).describe("Data for the prerequisite action"),
  reason: z.string().describe("Why this needs to be created first"),
});

export const SuggestedActionSchema = z.object({
  intent: ActionIntentSchema.describe("The type of action to perform"),
  confidence: z.number().min(0).max(1).describe("Confidence score from 0 to 1"),
  targetObject: z.string().describe("The Attio object type: people, companies, deals, etc."),
  targetList: z.string().optional().describe("The list to add to, if applicable"),
  extractedData: z.record(z.any()).describe("Extracted field values from messages and instruction"),
  missingRequired: z.array(z.string()).describe("Required fields that are missing"),
  clarificationsNeeded: z.array(ClarificationSchema).describe("Things that need user clarification"),
  prerequisiteActions: z.array(PrerequisiteActionSchema).optional().describe("Actions that should be created first, like creating a company before linking a person to it"),
  reasoning: z.string().describe("Brief explanation of why this action was chosen"),
  noteTitle: z.string().describe("Suggested title for the note that will be created from the forwarded messages"),
});

// Action result after execution
export interface ActionResult {
  success: boolean;
  recordId?: string;
  recordUrl?: string;
  noteId?: string;
  error?: string;
}

export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

// Context for AI analysis
export interface AIContext {
  messages: Array<{
    text: string;
    senderUsername?: string;
    senderFirstName?: string;
    senderLastName?: string;
    chatName: string;
    date: number;
  }>;
  instruction: string;
  schema: AttioSchema;
}

// API response types
export interface AttioApiObject {
  id: {
    workspace_id: string;
    object_id: string;
  };
  api_slug: string;
  singular_noun: string;
  plural_noun: string;
  created_at: string;
}

export interface AttioApiAttribute {
  id: {
    workspace_id: string;
    object_id: string;
    attribute_id: string;
  };
  title: string;
  description: string;
  api_slug: string;
  type: string;
  is_system_attribute: boolean;
  is_writable: boolean;
  is_required: boolean;
  is_unique: boolean;
  is_multiselect: boolean;
  is_default_value_enabled: boolean;
  is_archived: boolean;
  default_value: unknown;
  relationship: unknown;
  config: unknown;
}

export interface AttioApiList {
  id: {
    workspace_id: string;
    list_id: string;
  };
  api_slug: string;
  name: string;
  parent_object: string;
  parent_object_id: string;
  workspace_access: string;
  workspace_member_access: string;
  created_by_actor: unknown;
  created_at: string;
}

export interface AttioApiWorkspaceMember {
  id: {
    workspace_id: string;
    workspace_member_id: string;
  };
  first_name: string;
  last_name: string;
  email_address: string;
  avatar_url: string | null;
  access_level: string;
  created_at: string;
}
