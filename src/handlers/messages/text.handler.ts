/**
 * Re-exports from modular text handlers for backwards compatibility.
 * @deprecated Import from "@/src/handlers/messages/text" instead.
 *
 * Text message handling has been split into focused modules:
 * - index.ts - Main router
 * - idle.handler.ts - Idle/gathering state
 * - clarification.handler.ts - Clarification answers
 * - edit.handler.ts - Field editing
 * - assignee-input.handler.ts - Assignee name input
 * - note-parent-search.handler.ts - Note parent search
 */

export { handleText } from "./text";
