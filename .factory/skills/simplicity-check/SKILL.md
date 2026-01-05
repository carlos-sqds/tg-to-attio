---
name: simplicity-check
description: Auto-spawn a sub-agent to critique solution complexity before implementation. Use when proposing multiple files, components, or architectural decisions. Prevents over-engineering.
---

# Simplicity Check Skill

Automatically validate that proposed solutions aren't over-engineered before implementing.

## When to Trigger

Invoke this check when proposing:
- Multiple new files/components for a single feature
- Splitting functionality across separate modules
- Creating abstractions (interfaces, base classes, factories)
- Multi-step architectural changes
- Any solution with 3+ moving parts

## Process

### Step 1: Pause Before Implementation

When you've drafted a solution, STOP and spawn the `code-simplicity-reviewer` droid:

```
Task: code-simplicity-reviewer
Prompt: Review this proposed solution for unnecessary complexity:

[Paste your proposed approach]

Questions to answer:
1. Can this be done with fewer files/components?
2. Is the separation of concerns premature?
3. What's the simplest version that solves the actual problem?
4. Are we building for hypothetical future needs (YAGNI violation)?
```

### Step 2: Evaluate Response

The sub-agent will return one of:
- **APPROVE** - Complexity is justified
- **SIMPLIFY** - Specific recommendations to reduce complexity
- **REJECT** - Start over with simpler approach

### Step 3: Act on Feedback

- If SIMPLIFY/REJECT: Revise proposal and present simpler alternative to user
- If APPROVE: Proceed with implementation

## Complexity Red Flags

Automatic triggers for this check:
- Creating 2+ new files for one feature
- Proposing "Option A vs Option B vs Option C"
- Using words like "flexible", "extensible", "future-proof"
- Adding abstraction layers
- Splitting a skill/component into multiple parts

## The Golden Questions

Before any implementation, ask:

> "What's the least amount of code/files that solves exactly what the user asked for?"

> "Can an agent easily understand, navigate, and modify this code?"

See @.shared/agent-ready-code.md for agent-readiness principles.

## Examples

### Over-engineered (BAD)
```
Create 3 skills:
- linear-usage (MCP tools)
- linear-github-sync (integration)
- linear-workflow (conventions)
```

### Right-sized (GOOD)
```
Create 1 skill:
- linear (covers MCP + GitHub integration + workflow)
```

### Over-engineered (BAD)
```
Create abstract base class, factory pattern, 
and strategy interface for notification system
```

### Right-sized (GOOD)
```
Create single notification function, 
refactor later if actually needed
```

## Escape Hatch

Skip this check only when:
- User explicitly requests the complex approach
- Regulatory/security requirements mandate separation
- Existing codebase patterns require it
