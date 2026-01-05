# Agentic Coding Framework

Unified configuration for AI-assisted development with **Factory Droid** and **Claude Code**.

## Table of Contents

- [Quick Start](#quick-start)
- [Claude Code vs Factory Droid](#claude-code-vs-factory-droid)
- [What's Included](#whats-included)
- [Documentation](#documentation)
- [Structure](#structure)
- [Configuration](#configuration)
- [Extending](#extending)

## Quick Start

Clone this repo into your project or use it as a template:

```bash
# Copy the config directories to your project
cp -r .factory .claude .shared AGENTS.md CLAUDE.md /path/to/your/project/
```

**Using Claude Code?** You're ready to go - Claude Code reads from `.claude/` which symlinks to `.factory/` for shared config.

**Using Factory Droid?** Same setup - Droid reads directly from `.factory/`.

## Claude Code vs Factory Droid

This framework works with both tools. Here's how they compare:

| Feature | Factory Droid | Claude Code |
|---------|---------------|-------------|
| Model support | Claude, GPT, Codex | Claude only |
| Subagents | Called "droids" | Called "agents" |
| Config location | `.factory/` | `.claude/` |
| Skills | ✓ | ✓ |
| Commands | ✓ | ✓ |
| MCP support | ✓ | ✓ |
| Hooks | ✓ | ✗ |

**Key differences:**
- **Model flexibility**: Droid can use Codex models for code review; Claude Code uses Claude models only
- **Terminology**: We use "droids" in `.factory/` and "agents" in `.claude/` - same concept, different names
- **Hooks**: Droid supports automation hooks (e.g., caffeinate during long tasks); Claude Code doesn't have this feature yet

**For Claude Code users**: The dual-model review features (Codex + Opus) fall back to Claude-only models. You still get multi-perspective reviews, just with different model combinations.

## What's Included

### Commands

| Command | Purpose |
|---------|---------|
| `/plan <task>` | Create implementation plan before coding |
| `/linear <id>` | Work with Linear issues |
| `/review [files]` | Multi-model code review (dual Codex+Opus) |
| `/stage-and-review` | Stage all changes and run review |
| `/compound` | Document solved problems |

### Subagents (Droids/Agents)

Specialized subagents for specific tasks. Called "droids" in Factory Droid, "agents" in Claude Code - same functionality:

- **Reviewers**: `rust-reviewer`, `typescript-reviewer`, `security-reviewer`, `architecture-reviewer`
- **Dual-model reviewers** (Droid only): `rust-reviewer-opus`, `typescript-reviewer-opus` for multi-perspective review
- **Analyzers**: `codebase-analyzer`, `git-history-analyzer`, `performance-reviewer`
- **Utilities**: `linear-search`, `best-practices-researcher`, `quick-checker`

### Skills

Auto-invoked capabilities:

- `linear` - Linear issue management
- `agentic-config` - Framework configuration guide
- `simplicity-check` - YAGNI enforcement
- `compound-docs` - Knowledge capture
- `sync-docs` - Auto-update docs when config changes
- `pre-commit` - Run checks before commits
- `changelog` - Generate changelog for PRs

### MCP Integrations

- Linear (issue tracking)
- Playwright (browser automation)
- Context7 (documentation lookup)

## Documentation

- **[Tutorial](docs/tutorial.md)** - Quick reference and workflow guide
- **[Behind the Scenes](docs/framework-guide.md)** - Deep dive into architecture, design philosophy, and how to extend the framework

## Structure

```
.factory/           # Primary config (used by Droid, partially symlinked to .claude/)
├── commands/       # Slash commands
├── skills/         # Auto-invoked capabilities
├── droids/         # Specialized subagents (Droid terminology)
├── hooks/          # Automation hooks (Droid only)
└── mcp.json        # MCP servers

.claude/            # Claude Code config
├── skills/         # → symlink to .factory/skills
├── commands/       # → symlink to .factory/commands
├── agents/         # NOT symlinked (model differences require translation)
└── settings.json   # Claude Code-specific settings

.shared/            # Shared context files (language patterns, workflows)
```

**Why the split?** Skills and commands work identically in both tools. Subagents (droids/agents) need different model references - Droid can use Codex, Claude Code can't - so we maintain separate copies with translated model configs.

## Configuration

1. Set up Linear API key:
   ```bash
   export LINEAR_API_KEY="lin_api_xxxxx"
   ```

2. Configure MCP servers in `.factory/mcp.json`

3. Customize patterns in `.shared/` for your stack

## Extending

Use the `agentic-config` skill to add new commands, skills, or droids:

```
I want to add a new command for generating changelog entries
```

## License

MIT
