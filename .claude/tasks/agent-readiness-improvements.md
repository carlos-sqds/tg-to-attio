# Plan: Improve Agent-Readiness of Attio-TG Repository

## Overview

Refactor the codebase to better align with agent-ready code principles, focusing on file size limits, function complexity, type safety, and searchability.

## Current State Assessment

**Overall Score: 7.5/10** - Good foundation with notable issues.

### Violations Found

| Issue | Severity | Files Affected |
|-------|----------|----------------|
| Files > 300 lines | CRITICAL | `attio.actions.ts` (883), `keyboards.ts` (313), `text.handler.ts` (247) |
| Functions > 30 lines | HIGH | 6 functions across 4 files |
| `Record<string, unknown>` usage | MEDIUM | 14 instances in `attio.actions.ts`, `keyboards.ts` |
| Magic intent strings | MEDIUM | 9 case statements without typed constants |
| Tests not colocated | LOW | All tests in separate `/tests/` directory |

### Positive Findings (Preserve)
- Strict TypeScript mode, no `any` types
- Explicit imports with `@/src/` alias (no barrel files)
- Named exports only
- Clean dependency graph (no circular imports)
- Properly typed callback actions and session states

## Requirements

- [ ] All files < 300 lines
- [ ] All functions < 30 lines
- [ ] No `Record<string, unknown>` for data access
- [ ] Intent strings typed as constants
- [ ] Maintain 100% test coverage during refactor

## Approach

Incremental refactoring with these priorities:
1. **P0**: Split largest file (`attio.actions.ts`) - highest impact
2. **P1**: Extract intent type constants - enables safer refactoring
3. **P2**: Split `text.handler.ts` by state routes
4. **P3**: Split `keyboards.ts` by feature
5. **P4**: Replace dynamic key access patterns

## Implementation Steps

### Step 1: Create Intent Type Constants
- **Files**: Create `src/lib/types/intent.types.ts`
- **Changes**:
  - Define `AttioIntents` const object with all intent strings
  - Export `AttioIntent` type as union of values
  - Update imports in `attio.actions.ts`, `keyboards.ts`, `ai.intent.ts`
- **Tests**: Ensure existing tests pass after type update

```typescript
// src/lib/types/intent.types.ts
export const AttioIntents = {
  CREATE_PERSON: "create_person",
  CREATE_COMPANY: "create_company",
  CREATE_DEAL: "create_deal",
  CREATE_TASK: "create_task",
  ADD_NOTE: "add_note",
  ADD_TO_LIST: "add_to_list",
} as const;

export type AttioIntent = typeof AttioIntents[keyof typeof AttioIntents];
```

### Step 2: Split `attio.actions.ts` (883 → 7 files)
- **Files**: Create `src/workflows/attio-actions/` directory
- **Structure**:
  ```
  src/workflows/attio-actions/
  ├── index.ts              # Re-exports all action functions
  ├── api.ts                # attioRequest, getRecordUrl (shared utils)
  ├── people.action.ts      # createPerson
  ├── companies.action.ts   # createCompany
  ├── deals.action.ts       # createDeal
  ├── tasks.action.ts       # createTask
  ├── notes.action.ts       # addNote
  ├── lists.action.ts       # addToList
  └── execute.action.ts     # executeActionWithNote (orchestrator)
  ```
- **Changes**:
  - Extract each action into its own file (~100-150 lines each)
  - Move shared types/utils to `api.ts`
  - `execute.action.ts` imports and orchestrates individual actions
  - Update all imports across codebase
- **Tests**: Run `npm run test:run` after each extraction

### Step 3: Refactor `executeActionWithNote` Function
- **Files**: `src/workflows/attio-actions/execute.action.ts`
- **Changes**:
  - Replace 310-line switch statement with action registry pattern
  - Create `ActionExecutor` type and registry object
  - Each action file exports an executor function
  - Main function looks up and calls executor
- **Tests**: Add unit tests for each action executor

```typescript
// Pattern for execute.action.ts
type ActionExecutor = (params: ExecuteParams) => Promise<ActionResult>;

const actionExecutors: Record<AttioIntent, ActionExecutor> = {
  [AttioIntents.CREATE_PERSON]: executeCreatePerson,
  [AttioIntents.CREATE_COMPANY]: executeCreateCompany,
  // ...
};

export async function executeActionWithNote(params: ExecuteParams): Promise<ExecuteResult> {
  const executor = actionExecutors[params.intent];
  if (!executor) throw new Error(`Unknown intent: ${params.intent}`);
  return executor(params);
}
```

### Step 4: Split `text.handler.ts` by State (247 → 6 files)
- **Files**: Create `src/handlers/messages/text/` directory
- **Structure**:
  ```
  src/handlers/messages/text/
  ├── index.ts                      # Router function
  ├── idle.handler.ts               # idle, gathering_messages states
  ├── clarification.handler.ts      # awaiting_clarification
  ├── edit.handler.ts               # awaiting_edit
  ├── assignee-input.handler.ts     # awaiting_assignee_input
  └── note-parent-search.handler.ts # awaiting_note_parent_search
  ```
- **Changes**:
  - Extract each case from switch statement into handler file
  - Main `index.ts` routes based on session state
  - Each handler ~40-60 lines
- **Tests**: Existing tests should pass without modification

### Step 5: Split `keyboards.ts` by Feature (313 → 5 files)
- **Files**: Create `src/lib/telegram/keyboards/` directory
- **Structure**:
  ```
  src/lib/telegram/keyboards/
  ├── index.ts                    # Re-exports all builders
  ├── constants.ts                # Intent labels, emojis, etc.
  ├── confirmation.keyboard.ts   # buildConfirmationKeyboard
  ├── clarification.keyboard.ts  # buildClarificationKeyboard
  ├── edit-field.keyboard.ts     # buildEditFieldKeyboard
  └── assignee.keyboard.ts       # buildAssigneeKeyboard, pagination
  ```
- **Changes**:
  - Extract each keyboard builder
  - Move shared constants (labels, emojis) to `constants.ts`
  - Each file ~60-80 lines
- **Tests**: Visual verification via Telegram test

### Step 6: Replace `Record<string, unknown>` Patterns
- **Files**: Various (14 instances)
- **Changes**:
  - Create typed accessor functions for data extraction
  - Add proper type definitions for extracted data shapes
  - Example for deadline extraction:
    ```typescript
    interface TaskData {
      deadline?: string;
      due_date?: string;
      'due date'?: string;
    }

    function extractDeadline(data: TaskData): string | undefined {
      return data.deadline ?? data.due_date ?? data['due date'];
    }
    ```
- **Tests**: Type-check should catch any regressions

## Files to Modify

| File | Changes |
|------|---------|
| `src/workflows/attio.actions.ts` | Split into 8 files, then delete |
| `src/handlers/messages/text.handler.ts` | Split into 6 files, then delete |
| `src/lib/telegram/keyboards.ts` | Split into 5 files, then delete |
| `src/workflows/ai.intent.ts` | Update imports for intent types |
| `src/handlers/callbacks/*.ts` | Update imports |

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/types/intent.types.ts` | Typed intent constants |
| `src/workflows/attio-actions/index.ts` | Action module exports |
| `src/workflows/attio-actions/api.ts` | Shared API utilities |
| `src/workflows/attio-actions/*.action.ts` | Individual action handlers (6 files) |
| `src/handlers/messages/text/index.ts` | Text handler router |
| `src/handlers/messages/text/*.handler.ts` | State-specific handlers (5 files) |
| `src/lib/telegram/keyboards/index.ts` | Keyboard module exports |
| `src/lib/telegram/keyboards/*.ts` | Individual keyboard builders (4 files) |

## Testing Strategy

- **Unit tests**: Run `npm run test:run` after each step
- **Type checking**: Run `npm run type-check` after each step
- **Manual testing**: Test key flows via Telegram after major changes:
  - Create a person
  - Create a company
  - Create a task with deadline
  - Add a note to existing record

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking imports across codebase | Use TypeScript compiler to catch all broken references |
| Test coverage gaps | Run tests incrementally, verify coverage |
| Runtime behavior changes | Manual Telegram testing for key flows |
| Large PR scope | Can split into multiple PRs by step if needed |

## Open Questions

- [ ] Should we colocate tests (`*.test.ts` next to implementation)? Current `/tests/` structure works but violates agent-ready principles. Recommend deferring this to a separate task.
- [ ] Should we rename the old files or delete them entirely after splitting?

## Progress Tracking

- [ ] Step 1: Create Intent Type Constants
- [ ] Step 2: Split `attio.actions.ts`
- [ ] Step 3: Refactor `executeActionWithNote`
- [ ] Step 4: Split `text.handler.ts`
- [ ] Step 5: Split `keyboards.ts`
- [ ] Step 6: Replace `Record<string, unknown>` patterns
- [ ] Final verification: All checks pass

## Verification Checklist

Before marking complete:
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run test:run` passes
- [ ] All files < 300 lines
- [ ] All functions < 30 lines
- [ ] Manual Telegram testing confirms functionality
