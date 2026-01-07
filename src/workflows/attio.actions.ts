/**
 * Re-exports from modular attio-actions for backwards compatibility.
 * @deprecated Import from "@/src/workflows/attio-actions" instead.
 *
 * All action logic has been split into focused modules:
 * - api.ts - Shared API utilities
 * - companies.action.ts - Company CRUD
 * - people.action.ts - Person CRUD
 * - deals.action.ts - Deal CRUD
 * - tasks.action.ts - Task CRUD + deadline parsing
 * - notes.action.ts - Note CRUD
 * - lists.action.ts - List operations
 * - search.action.ts - Record search
 * - execute.action.ts - Composite action orchestration
 */

export {
  // API utilities
  attioRequest,
  getApiKey,
  getRecordUrl,
  ATTIO_BASE_URL,
  // Company operations
  createCompany,
  // Person operations
  createPerson,
  // Deal operations
  createDeal,
  clearDealStagesCache,
  // Task operations
  createTask,
  parseCompanyInput,
  toAttioDateFormat,
  parseDeadline,
  // Note operations
  createNote,
  // List operations
  addToList,
  // Search operations
  searchRecords,
  // Composite operations
  executeActionWithNote,
} from "./attio-actions";

export type {
  ActionResult,
  AttioRecordResponse,
  AttioNoteResponse,
  AttioTaskResponse,
  AttioEntryResponse,
  CreateCompanyInput,
  CreatePersonInput,
  CreateDealInput,
  CreateTaskInput,
  CreateNoteInput,
  AddToListInput,
  ExecuteActionInput,
} from "./attio-actions";
