---
name: agentic-config
description: Guide for updating this agentic coding framework. Use when adding skills, droids/agents, commands, or modifying AGENTS.md/CLAUDE.md. Teaches the unified config structure that works with both Factory Droid and Claude Code.
---

# Agentic Config Framework

This skill teaches how to update and extend this agentic coding configuration that works with **both Factory Droid and Claude Code**.

## Architecture Overview

```
.factory/                    # PRIMARY for Droid - supports Codex/GPT models
├── skills/<name>/SKILL.md   # Auto-invoked capabilities (symlinked to .claude)
├── droids/<name>.md         # Subagents - can use gpt-5.1-codex, opus, etc.
├── commands/<name>.md       # Slash commands (symlinked to .claude)
├── hooks/                   # Automation hooks
└── mcp.json                 # MCP servers

.claude/                     # For Claude Code
├── skills -> ../.factory/skills    # SYMLINKED (fully compatible)
├── agents/                         # SEPARATE - uses sonnet/opus/haiku aliases
├── commands -> ../.factory/commands # SYMLINKED (fully compatible)
└── settings.json            # Claude-specific (MCP, permissions)

.shared/                     # Shared context files
├── context.md               # Core project info
├── rust-patterns.md         # Rust conventions
├── typescript-patterns.md   # TS conventions
└── linear-workflow.md       # Linear integration

AGENTS.md                    # Droid reads this + imports .shared/*
CLAUDE.md                    # Imports AGENTS.md via @AGENTS.md
```

## Adding a Skill

Skills are auto-invoked based on task context. Create `.factory/skills/<name>/SKILL.md`:

```markdown
---
name: my-skill-name
description: What it does. Use when [trigger conditions].
---

# My Skill Name

## Instructions
1. Step one
2. Step two

## Examples
[Concrete examples]
```

**Rules:**
- `name`: lowercase, hyphens only (max 64 chars)
- `description`: Include WHAT it does and WHEN to use it (max 1024 chars)
- Keep SKILL.md < 500 lines
- Link to reference files for detailed docs: `See [reference.md](reference.md)`

## Adding a Droid/Agent

Droids are subagents for specific tasks. Create `.factory/droids/<name>.md`:

```markdown
---
name: my-droid
description: When to invoke this droid (max 500 chars)
model: inherit
tools: ["Read", "Grep", "Glob"]
---

You are a specialist in [domain]. When invoked:

1. [What to analyze]
2. [What to output]

## Output Format
Summary: <one-line>
Findings:
- <item>
```

**Fields:**
| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | lowercase, hyphens, underscores |
| `description` | No | Shown in UI |
| `model` | No | `inherit`, `sonnet`, `opus`, `haiku`, or full model ID |
| `tools` | No | Omit for all tools, or array like `["Read", "Edit"]` |

**Tool categories:** `read-only`, `edit`, `execute`, `web`, `mcp`

## Adding a Command

Commands are user-invoked via `/command-name`. Create `.factory/commands/<name>.md`:

```markdown
---
description: What this command does
argument-hint: <optional-args>
---

[Instructions for the agent when this command is invoked]

Use $ARGUMENTS to access user input after the command name.
```

## Updating Shared Context

Edit files in `.shared/` for context that applies to both tools:
- `context.md` - Project overview, commands, git workflow
- `rust-patterns.md` - Rust/Axum conventions
- `typescript-patterns.md` - TS/NextJS conventions
- `linear-workflow.md` - Linear integration

These are imported into AGENTS.md via `@.shared/filename.md` syntax.

## Sync Strategy

**No sync needed!** The setup uses:
1. AGENTS.md as source of truth (Droid native)
2. CLAUDE.md imports AGENTS.md via `@AGENTS.md`
3. Symlinks share skills/droids/commands between tools

**Always edit in `.factory/`** - changes automatically apply to both tools.

## Adding MCP Servers

Edit `.factory/mcp.json` for Droid:
```json
{
  "mcpServers": {
    "server-name": {
      "type": "http",
      "url": "https://example.com/mcp"
    }
  }
}
```

Edit `.claude/settings.json` for Claude Code (same format in `mcpServers` key).

## Model Compatibility

**Factory Droid** supports more models:
- `gpt-5.1-codex`, `gpt-5.1-codex-max`, `gpt-5.1`, `gpt-5.2`
- `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`
- Aliases: `opus`, `sonnet`, `haiku`

**Claude Code** only supports aliases:
- `sonnet`, `opus`, `haiku`, `inherit`

### Current Model Assignments

| Droid/Agent | Factory Droid | Claude Code |
|-------------|---------------|-------------|
| quick-checker | claude-haiku-4-5-20251001 | haiku |
| rust-reviewer | gpt-5.1-codex | sonnet |
| typescript-reviewer | gpt-5.1-codex | sonnet |
| security-reviewer | opus | opus |
| architecture-reviewer | opus | opus |
| review-coordinator | opus | opus |

### Syncing Droids to Claude Agents

When you modify a droid in `.factory/droids/`, sync to `.claude/agents/`:

```bash
# Sync all droids to Claude agents (converts models to aliases)
for f in .factory/droids/*.md; do
  sed 's/model: gpt-5.1-codex/model: sonnet/g; s/model: claude-haiku-4-5-20251001/model: haiku/g' "$f" > ".claude/agents/$(basename $f)"
done
```

Or manually copy and change the `model:` line to use aliases.

## Checklist When Modifying Config

- [ ] Edit droids in `.factory/droids/`
- [ ] Sync droids to `.claude/agents/` with compatible model aliases
- [ ] Skills have `name` and `description` in frontmatter
- [ ] Droids have `name` in frontmatter
- [ ] Commands have `description` in frontmatter
- [ ] Shared context updated in `.shared/` if needed
- [ ] Test with both `droid` and `claude` if possible
