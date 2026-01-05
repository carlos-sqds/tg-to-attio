---
title: Commands as the User Interface to Subagents
category: patterns
tags: [commands, droids, agents, subagents, discoverability, factory-droid, claude-code]
created: 2026-01-03
symptoms: [orphaned droids, undiscoverable features, model alias errors]
root_cause: Droids/agents created without corresponding user-facing commands
stack: [agentic-coding, factory-droid, claude-code]
severity: moderate
---

# Commands as the User Interface to Subagents

## Problem

Framework had powerful specialized subagents (droids/agents) that users couldn't discover or use because there were no corresponding `/commands` to expose them.

## Symptoms

- Users needed to know internal subagent names to use them
- Valuable capabilities went unused
- Model alias errors (`Invalid model: opus`) when running subagents
- Inconsistent delegation patterns across commands

## Root Cause

1. Subagents created as implementation details without user-facing wrappers
2. Model aliases (`opus`, `sonnet`) used instead of full model IDs
3. No enforced pattern requiring commands to wrap subagents

## Solution

> [!IMPORTANT]
> **Principle:** Commands = user interface, subagents = hidden implementation.

Every subagent that users might want to invoke should have a corresponding command:

| Command | Subagent | Purpose |
|---------|----------|---------|
| `/analyze` | `codebase-analyzer` | Understand repo structure |
| `/history` | `git-history-analyzer` | Code evolution context |
| `/perf` | `performance-reviewer` | Performance review |
| `/simplify` | `code-simplicity-reviewer` | YAGNI check |
| `/research` | `best-practices-researcher` | External patterns |
| `/review` | multiple reviewers | Code review pipeline |

## Code Example

Command file (`.factory/commands/analyze.md`):
```markdown
---
description: Understand codebase structure and conventions
argument-hint: [directory-or-focus-area]
---

# Analyze Codebase

## Execution

Spawn `codebase-analyzer` subagent with the scope and return a summary of:
- Project structure and architecture
- Key patterns and conventions in use
```

**Key details**:
- Use "Spawn `X` subagent" (neutral, works for both Droid and Claude Code)
- Don't say "droid" or "agent" - use "subagent"
- Use full model IDs in droid configs, not aliases

## Model Configuration

Use full IDs in `.factory/droids/`:

```yaml
# BAD - aliases don't work in Factory Droid
model: sonnet
model: opus

# GOOD - full model IDs
model: claude-sonnet-4-5-20250929
model: claude-opus-4-5-20251101
```

> [!WARNING]
> Model aliases like `opus` or `sonnet` don't work in Factory Droid - always use full model IDs.

## Prevention

When creating a new subagent, ask:
1. Would a user ever want to invoke this directly?
2. If yes → create a command wrapper
3. If no (purely agent-internal) → no command needed

## Related

- `docs/solutions/patterns/skill-vs-droid-design-20260103.md` - When to use skills vs droids
- `.factory/skills/agentic-config/SKILL.md` - Framework structure guide
