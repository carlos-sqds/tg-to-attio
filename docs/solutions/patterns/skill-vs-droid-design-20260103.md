---
title: When to use Skills vs Droids (and keeping them simple)
category: patterns
tags: [skills, droids, agents, architecture, yagni]
created: 2026-01-03
symptoms: [over-engineered proposals, split functionality, context bloat]
root_cause: Premature separation of concerns
stack: [agentic-coding, factory-droid, claude-code]
severity: moderate
---

# When to use Skills vs Droids (and keeping them simple)

## Problem

When adding new capabilities to the agentic framework, it's tempting to:
1. Split functionality into multiple skills "for separation of concerns"
2. Keep everything in the main agent, bloating context with multi-call operations

## Symptoms

- Proposals with 2-3+ separate skills for one feature
- Main conversation context filled with iterative MCP calls
- Overlapping skill descriptions causing confusion about which to invoke

## Root Cause

Premature abstraction and not considering context cost of operations.

## Solution

### Use Skills When:
- Teaching the main agent *how* to do something
- Providing conventions, patterns, or reference info
- Capability is used inline with other work

### Use Droids When:
- Operation requires multiple iterative calls (searches, analysis)
- Output can be summarized concisely
- Work is isolated and doesn't need main conversation context

### Keep Skills Consolidated:
- One skill per domain (e.g., `linear` not `linear-usage` + `linear-github-sync`)
- Split only when triggers are genuinely different
- Under 500 lines? Keep it together

## Code Example

> [!CAUTION]
> **Over-engineered (BAD):**
> ```
> .factory/skills/
> ├── linear-usage/SKILL.md      # MCP tools
> ├── linear-github-sync/SKILL.md # GitHub integration
> └── linear-workflow/SKILL.md    # Conventions
> ```

> [!TIP]
> **Right-sized (GOOD):**
> ```
> .factory/skills/
> └── linear/SKILL.md             # All Linear knowledge
> 
> .factory/droids/
> └── linear-search.md            # Delegated search (keeps context clean)
> ```

## Prevention

1. Add `simplicity-check` skill that auto-triggers before implementation
2. Ask: "What's the least code that solves exactly what was asked?"
3. For MCP-heavy operations, consider a droid to summarize results

## Related

- `.factory/skills/simplicity-check/SKILL.md` - Auto-critique for complexity
- `.factory/skills/agentic-config/SKILL.md` - Framework structure guide
