---
description: Create an implementation plan for a feature or task before coding
argument-hint: <task-description>
---

# Implementation Plan

Create a detailed implementation plan for: $ARGUMENTS

## Planning Process
1. **Understand**: Clarify requirements and scope
2. **Research**: Spawn `codebase-analyzer` subagent to examine existing code patterns and dependencies
3. **Design**: Outline the approach and architecture
4. **Breakdown**: Split into discrete, testable steps
5. **Risks**: Identify potential issues and mitigations

## Plan Format

```markdown
# Plan: [Task Title]

## Overview
[1-2 sentence summary]

## Requirements
- [ ] [Requirement 1]
- [ ] [Requirement 2]

## Approach
[High-level description of the solution]

## Implementation Steps
1. **[Step Name]** (estimate: Xh)
   - Files: `path/to/file.rs`
   - Changes: [description]
   - Tests: [what to test]

2. **[Step Name]** (estimate: Xh)
   ...

## Files to Modify
- `path/to/file` - [what changes]

## Files to Create
- `path/to/new/file` - [purpose]

## Testing Strategy
- Unit tests: [what to test]
- Integration tests: [what to test]

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| [Risk] | [How to handle] |

## Open Questions
- [ ] [Question needing clarification]
```

## After Planning
Ask if the user wants to:
1. Refine the plan
2. Start implementation
3. Save the plan to `.factory/docs/`
