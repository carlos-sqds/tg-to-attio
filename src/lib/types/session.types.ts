import type { ForwardedMessageData } from "@/src/types";
import type {
  SuggestedAction,
  AttioSchema,
  Clarification,
  WorkspaceMember,
} from "@/src/services/attio/schema-types";

/**
 * Caller information from Telegram user who initiated the action.
 * Used for "me" resolution and default assignee.
 */
export interface CallerInfo {
  firstName?: string;
  lastName?: string;
  username?: string;
}

/**
 * Search result for record lookups (companies, people, deals).
 */
export interface SearchResult {
  id: string;
  name: string;
  extra?: string;
}

/**
 * Pending instruction waiting for a forwarded message.
 * Stored in KV with 2-second TTL for forward correlation.
 */
export interface PendingInstruction {
  text: string;
  messageId: number;
  callerInfo: CallerInfo;
  createdAt: string;
}

/**
 * Conversation state as a discriminated union.
 * Each state carries its own context data for type-safe handling.
 */
export type ConversationState =
  | { type: "idle" }
  | { type: "gathering_messages" }
  | { type: "awaiting_instruction" }
  | { type: "processing_ai" }
  | {
      type: "awaiting_confirmation";
      action: SuggestedAction;
    }
  | {
      type: "awaiting_clarification";
      index: number;
      questions: Clarification[];
    }
  | {
      type: "awaiting_edit";
      field: string;
      originalValue: unknown;
    }
  | {
      type: "awaiting_assignee";
      page: number;
      members: WorkspaceMember[];
    }
  | {
      type: "awaiting_assignee_input";
    }
  | {
      type: "awaiting_note_parent_type";
    }
  | {
      type: "awaiting_note_parent_search";
      parentType: "companies" | "people" | "deals";
    }
  | {
      type: "awaiting_note_parent_selection";
      results: SearchResult[];
    }
  | { type: "executing" };

/**
 * Full session state persisted in KV.
 * All conversation context is stored here between requests.
 */
export interface SessionState {
  /** Current conversation state (discriminated union) */
  state: ConversationState;

  /** Queue of forwarded messages awaiting processing */
  messageQueue: ForwardedMessageData[];

  /** Current suggested action from AI */
  currentAction: SuggestedAction | null;

  /** Cached Attio schema (fetched once per session) */
  schema: AttioSchema | null;

  /** ID of last bot message for editing */
  lastBotMessageId: number | null;

  /** User instruction from /done or /new */
  currentInstruction: string | null;

  /** Caller info for "me" and default assignee resolution */
  callerInfo: CallerInfo | null;

  /** Session metadata */
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new empty session state.
 */
export function createEmptySession(): SessionState {
  const now = new Date().toISOString();
  return {
    state: { type: "idle" },
    messageQueue: [],
    currentAction: null,
    schema: null,
    lastBotMessageId: null,
    currentInstruction: null,
    callerInfo: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Type guard for checking specific conversation states.
 * Enables exhaustive switch matching.
 */
export function isState<T extends ConversationState["type"]>(
  state: ConversationState,
  type: T
): state is Extract<ConversationState, { type: T }> {
  return state.type === type;
}
