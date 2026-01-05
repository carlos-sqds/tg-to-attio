# Attio-TG Agentic Coding

Agentic coding configuration for the **Telegram → Attio CRM Bot** project.

## Core Principle: Agent-Ready Code

**All code must be written for AI agent comprehension and modification.**

This is the foundational design principle. Before writing any code, consider: can an agent easily understand, navigate, and safely modify this?

@.shared/agent-ready-code.md

## Quick Reference
@.shared/context.md

## Deployment
- **Vercel Dashboard**: https://vercel.com/squadsv0/tg-to-attio
- **Vercel Scope**: `squadsv0`
- See `vercel` skill for CLI commands

## Language Patterns
- TypeScript/NextJS: @.shared/typescript-patterns.md
- Linear workflow: @.shared/linear-workflow.md

## Tool Differences

| Concept | Factory Droid | Claude Code |
|---------|---------------|-------------|
| Subagents | "Droids" in `.factory/droids/` | "Agents" in `.claude/agents/` |
| Models | Claude, GPT, Codex | Claude only |
| Hooks | Supported | Not supported |

**Terminology**: This repo uses "droids" as the generic term. Claude Code users: read "droid" as "agent" - they're the same thing.

**Model translation**: When adding a droid in `.factory/droids/`, copy it to `.claude/agents/` and replace `gpt-5.1-codex` with `claude-sonnet-4-5-20250929`.

## Framework Structure

```
.factory/           # Primary config location
├── skills/         # Auto-invoked capabilities (SKILL.md)
├── droids/         # Subagents for specific tasks
├── commands/       # Slash commands (/command-name)
├── hooks/          # Automation hooks
└── mcp.json        # MCP server config

.claude/            # Partially symlinked for compatibility
├── skills -> ../.factory/skills
├── agents/         # NOT symlinked (see note below)
├── commands -> ../.factory/commands
└── settings.json   # Claude-specific settings
```

## Updating This Config
See the `agentic-config` skill for guidance on adding/modifying skills, droids/agents, and commands.

**For subagents**: `.claude/agents/` is NOT symlinked to `.factory/droids/` due to model differences. When adding or modifying:
1. Create/edit in `.factory/droids/` first
2. Copy to `.claude/agents/`
3. Replace `gpt-5.1-codex` → `claude-sonnet-4-5-20250929` (or appropriate Claude model)

## Context Management

**Delegate aggressively to sub-agents** to keep main conversation context lean:

1. **Documentation lookups**: Use `best-practices-researcher` droid for any external documentation research (Context7, web searches). It isolates verbose/multi-language docs and returns only relevant summaries.

2. **Code analysis**: Use `codebase-analyzer` when exploring unfamiliar parts of the codebase rather than reading many files in main context.

3. **Reviews**: Use specialized reviewers (`quick-checker`, `typescript-reviewer`, etc.) even for smaller changes.

4. **Linear queries**: Use `linear-search` droid instead of MCP calls in main context.

**All documentation lookups should go through sub-agents**, including curated knowledge bases:
- Factory/Droid questions → delegate to sub-agent using `factory-docs` knowledge base
- Claude Code questions → delegate to sub-agent using `claude-code-docs` knowledge base
- External docs → delegate to `best-practices-researcher`

## Before Starting Any Task
Search `docs/solutions/` for keywords related to the task. Past solutions may save significant time:
```
Grep pattern: [key terms from task]
Path: docs/solutions/
```
If relevant solutions exist, apply them before investigating from scratch.

## Before Committing
**ALWAYS** run the `pre-commit` skill before any git commit to format and type-check staged files.

## Before Creating PRs
If your PR includes changes to `.factory/` or `.claude/` files, run the `sync-docs` skill to update documentation before creating the PR.

## Verification
Before completing any task:
1. Run `npm run lint` - fix any errors
2. Run `npm run type-check` - fix any type errors
3. Run `npm run test:run` - fix any failing tests
4. **Do not return to the user until all checks pass**

If tests fail due to your changes, debug and fix them before reporting completion. The user should never see failing tests from completed work.
