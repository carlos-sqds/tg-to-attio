/**
 * Attio CRM action modules.
 * Re-exports all action functions for easy importing.
 */

// API utilities
export { attioRequest, getApiKey, getRecordUrl, ATTIO_BASE_URL } from "./api";
export type {
  ActionResult,
  AttioRecordResponse,
  AttioNoteResponse,
  AttioTaskResponse,
  AttioEntryResponse,
} from "./api";

// Company operations
export { createCompany } from "./companies.action";
export type { CreateCompanyInput } from "./companies.action";

// Person operations
export { createPerson } from "./people.action";
export type { CreatePersonInput } from "./people.action";

// Deal operations
export { createDeal, clearDealStagesCache } from "./deals.action";
export type { CreateDealInput } from "./deals.action";

// Task operations
export { createTask, parseCompanyInput, toAttioDateFormat, parseDeadline } from "./tasks.action";
export type { CreateTaskInput } from "./tasks.action";

// Note operations
export { createNote } from "./notes.action";
export type { CreateNoteInput } from "./notes.action";

// List operations
export { addToList } from "./lists.action";
export type { AddToListInput } from "./lists.action";

// Search operations
export { searchRecords } from "./search.action";

// Prerequisite operations
export { executePrerequisites } from "./prerequisites.action";
export type { PrerequisiteAction, PrerequisiteResult } from "./prerequisites.action";

// Composite operations
export { executeActionWithNote } from "./execute.action";
export type { ExecuteActionInput } from "./execute.action";
