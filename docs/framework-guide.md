# Behind the Scenes: How This Framework Actually Works

What happens when you stop configuring AI coding tools and start teaching them?

This is a question we had to answer when building this framework. Most AI coding setups are static—you write some instructions, maybe add a few prompts, and hope for the best. But that approach breaks down fast. Your agents make the same mistakes repeatedly. Context gets lost between sessions. Every new feature feels like starting from scratch.

We wanted something different: a system where each task makes the next task easier. Where agents learn from past solutions. Where the complexity of your workflow grows, but so does your AI's ability to handle it.

This document explains how we built that system, why each piece exists, and how you can extend it for your own needs.

## Table of Contents

- [The Core Insight](#the-core-insight-agents-need-infrastructure)
- [The Three Primitives](#the-three-primitives-skills-droids-commands)
- [Claude Code vs Factory Droid](#claude-code-vs-factory-droid)
- [Deep Dive: Skills](#deep-dive-how-skills-work)
- [Deep Dive: Droids/Agents](#deep-dive-how-droids-work)
- [Deep Dive: Commands](#deep-dive-how-commands-work)
- [How Everything Connects](#how-everything-connects)
- [Extending the Framework](#extending-the-framework)
- [File Reference](#appendix-file-reference)

---

## The Core Insight: Agents Need Infrastructure

Here's something that isn't obvious until you've spent months with AI coding tools: raw intelligence isn't the bottleneck. Claude and GPT are smart enough to solve most problems. The bottleneck is *context*—giving the agent the right information at the right time.

Think about it. A senior engineer isn't valuable because they can type faster or know more syntax. They're valuable because they know *this* codebase, *these* patterns, *these* past mistakes. They have institutional knowledge that makes them productive.

AI agents start every session with amnesia. They're brilliant but context-free. The solution isn't better models—it's better infrastructure for preserving and delivering context.

That's what this framework is: infrastructure for agent memory and coordination.

---

## The Three Primitives: Skills, Droids, Commands

Everything in this framework reduces to three concepts:

**Skills** are automatic behaviors. They watch what you're doing and activate when relevant. When you say "commit this," the pre-commit skill runs formatting and type-checking without being asked. When you say "that fixed it," the compound-docs skill offers to document the solution. Skills are the framework's reflexes.

**Droids/Agents** are specialists you summon for specific jobs. Need a security review? Spawn a security-focused subagent. Want to understand a new codebase? Send the codebase-analyzer. They run in isolation, do their work, and report back. They're the framework's contractors.

> **Terminology note**: Factory Droid calls these "droids" (in `.factory/droids/`). Claude Code calls them "agents" (in `.claude/agents/`). Same concept, different names. This doc uses "droids" but everything applies to Claude Code agents too.

**Commands** are explicit actions. Type `/review` to trigger a full code review pipeline. Type `/plan` to generate an implementation plan. Commands are how you tell the system exactly what you want. They're the framework's buttons.

The magic isn't in any single piece—it's in how they compose. A `/review` command spawns multiple droids in parallel, each checking code from a different angle. A skill auto-invokes before commits to catch problems early. Solutions documented by one skill become searchable context for future sessions.

---

## Claude Code vs Factory Droid

This framework supports both tools. Here's what you need to know:

| Feature | Factory Droid | Claude Code |
|---------|---------------|-------------|
| Model support | Claude, GPT, Codex | Claude only |
| Subagents | "Droids" | "Agents" |
| Config location | `.factory/` | `.claude/` |
| Skills | ✓ | ✓ (symlinked) |
| Commands | ✓ | ✓ (symlinked) |
| Hooks | ✓ | ✗ |
| MCP | ✓ | ✓ |

### What This Means in Practice

**If you use Claude Code only:**
- Your config lives in `.claude/`
- Skills and commands are symlinked from `.factory/` - edit either location
- Agents in `.claude/agents/` use Claude models only
- Dual-model features (Codex + Opus reviews) use Claude models for both perspectives
- Hooks won't work - ignore any hook-related docs

**If you use Factory Droid only:**
- Your config lives in `.factory/`
- Full model flexibility including Codex for code review
- Hooks work for automation (e.g., caffeinate during long tasks)

**If you use both:**
- Edit skills and commands in `.factory/` - they auto-sync via symlinks
- Maintain separate droid/agent files with appropriate model configs
- When adding a droid: create in `.factory/droids/`, copy to `.claude/agents/`, translate models

---

## The Dual-Tool Problem (And How We Solved It)

Here's a practical reality: different AI coding tools have different strengths. Factory Droid supports more models (including Codex). Claude Code has tighter Anthropic integration. Some developers prefer one, some prefer the other.

We didn't want to maintain two separate configurations. That's a recipe for drift, inconsistency, and double the maintenance work.

The solution is symlinks and a clear separation of concerns:

```
.factory/                    # Source of truth
├── skills/                  # ──┐
├── commands/                # ──┼── Symlinked to .claude/
└── droids/                  # ──┘   (with model translation)

.claude/
├── skills -> ../.factory/skills      # Symlink
├── commands -> ../.factory/commands  # Symlink
└── agents/                           # NOT symlinked (model differences)
```

Skills and commands work identically in both tools, so we symlink them. Edit once in `.factory/`, and both tools get the update.

Droids need special handling because Factory Droid supports models that Claude Code doesn't (like `gpt-5.1-codex`). So `.claude/agents/` is a separate directory with translated model references. When you add a droid to `.factory/droids/`, you copy it to `.claude/agents/` and swap `gpt-5.1-codex` for `claude-sonnet-4-5-20250929`.

It's a small manual step, but it buys us compatibility across tools without sacrificing model flexibility.

---

## Deep Dive: How Skills Work

Skills are the most "magical" part of the framework because they activate without being called. Here's what's actually happening.

Every skill lives in a folder with a `SKILL.md` file:

```
.factory/skills/
├── pre-commit/
│   └── SKILL.md
├── compound-docs/
│   └── SKILL.md
└── changelog/
    └── SKILL.md
```

The `SKILL.md` file has two parts: YAML frontmatter that declares when the skill should activate, and markdown content that tells the agent what to do.

```yaml
---
name: pre-commit
description: Run formatting and type-checking before git commits. 
             Auto-invoke when user says "commit this", "ready to commit", 
             or when about to run git commit.
---

[Instructions for what the skill should do...]
```

The description field does double duty: it explains the skill to humans *and* provides trigger phrases the AI watches for. When you type something that matches those phrases, the framework activates the skill automatically.

This design means skills can be contextually intelligent. The `compound-docs` skill activates when you say "that worked" or "problem solved"—natural things you'd say after fixing a bug. You don't have to remember to document solutions; the system prompts you.

### The Skill Pattern

Most of our skills follow a similar structure:

1. **Detect** - Confirm the skill should actually run
2. **Gather** - Collect relevant context (files, git state, etc.)
3. **Check** - Verify preconditions are met
4. **Generate** - Create the output (docs, formatted code, etc.)
5. **Validate** - Make sure the output is correct
6. **Execute** - Apply the changes
7. **Follow-up** - Offer next steps

This pattern emerged from trial and error. We found that skills that jump straight to execution often make mistakes. The detect-gather-check phases give the AI time to understand context before acting.

---

## Deep Dive: How Droids Work

> **Claude Code users**: This section uses "droids" - the same concepts apply to your "agents" in `.claude/agents/`.

Droids (or agents) are subagents—separate AI instances that run in parallel with your main session. They're useful for tasks that are:

- **Compute-intensive**: Running 12 different review perspectives simultaneously
- **Context-heavy**: Analyzing an entire codebase without cluttering your main conversation
- **Specialized**: Security review requires different prompting than performance review

A droid definition looks like this:

```yaml
---
name: security-reviewer
description: Security-focused code review for Rust and TypeScript. 
             Checks for vulnerabilities, auth issues, data exposure.
model: claude-opus-4-5-20251101
reasoningEffort: high
---

You are a security-focused code reviewer. Your job is to find 
vulnerabilities before they ship...

[Detailed instructions for what to check and how to report findings]
```

The `model` and `reasoningEffort` fields let you tune each droid for its job. Quick syntax checks? Use Haiku. Deep architectural analysis? Use Opus with high reasoning. Language-specific expertise? Maybe Codex performs better.

### The Dual-Model Strategy

One pattern we've found effective is running two models on the same task. Our `/review` command spawns both `rust-reviewer` (Codex) and `rust-reviewer-opus` (Opus) for Rust code. Different models catch different things. A coordinator droid then synthesizes their findings.

This sounds expensive, but it's cheaper than shipping bugs. And the droids run in parallel, so wall-clock time isn't much worse than a single review.

> **Claude Code note**: Codex isn't available in Claude Code, so both reviewers use Claude models. You still get multi-perspective reviews - different prompting strategies catch different issues.

### The Review Pipeline

Here's how `/review` actually works:

```
/review [files]
       │
       ▼
┌─────────────────┐
│  quick-checker  │  ← Haiku: fast pass for obvious issues
│    (Phase 1)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Specialized Reviewers (Phase 2)        │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │rust-reviewer │  │rust-reviewer │                 │
│  │   (Codex)    │  │   (Opus)     │  ← Dual models  │
│  └──────────────┘  └──────────────┘                 │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  security-   │  │ architecture │                 │
│  │  reviewer    │  │   reviewer   │  ← Specialists  │
│  └──────────────┘  └──────────────┘                 │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ review-coordinator  │  ← Synthesize findings
              │   (Opus, high)      │
              └──────────┬──────────┘
                         │
                         ▼
                 Final Recommendation
                APPROVE / REQUEST CHANGES / BLOCK
```

This is orchestration at work. The `/review` command doesn't do the review—it coordinates specialists who each contribute a piece.

---

## Deep Dive: How Commands Work

Commands are the simplest primitive. They're explicit actions triggered by typing `/command-name`. A command file looks like this:

```yaml
---
description: Generate an implementation plan before coding
argument-hint: <task description>
---

You are about to help the user plan an implementation...

[Instructions for how to create the plan]
```

The key thing about commands is they can access user arguments via `$ARGUMENTS`. If someone types `/plan Add user authentication`, the command receives "Add user authentication" as context.

Commands often orchestrate droids. The `/review` command spawns reviewers. The `/analyze` command spawns the codebase-analyzer. This separation keeps commands lightweight—they describe *what* to do, while droids know *how* to do it.

---

## How Everything Connects

Let's trace through a realistic workflow to see how these pieces interact:

**Scenario: You're adding a new feature.**

1. You type: "I need to add rate limiting to the API"

2. The agent checks `docs/solutions/` (per AGENTS.md instructions) and finds a relevant past solution about rate limiting patterns.

3. You type `/plan rate limiting for /api/submit endpoint`

4. The `/plan` command spawns the codebase-analyzer to understand current API structure, then generates an implementation plan.

5. You approve the plan and say "let's build it"

6. The agent implements the feature, following patterns from the plan.

7. You say "ready to commit"

8. The `pre-commit` skill auto-activates, running formatters and type checks.

9. The agent notices `.factory/` files are staged and reminds you to run `sync-docs`.

10. You invoke `sync-docs`, which updates documentation.

11. Everything gets committed together.

12. You say "let's review this before pushing"

13. You run `/review` which spawns the full review pipeline.

14. Review passes. You push.

Every step used a different primitive. Skills handled automatic behaviors. Commands handled explicit actions. Droids handled specialized analysis. And the solutions library provided context from past work.

---

## The Compounding Effect

Here's why this matters: each solved problem makes future problems easier.

When you fix a tricky bug, the `compound-docs` skill offers to document it. That document goes into `docs/solutions/`. Next time an agent encounters similar symptoms, AGENTS.md tells it to search solutions first. The agent finds your documentation and applies the fix immediately.

When a code review catches an issue, the pattern gets added to reviewer prompts. Next time, the reviewer flags similar code automatically.

When you figure out the right way to structure a feature, that becomes part of the codebase context that the analyzer extracts. Future planning sessions benefit from your discovery.

This is the compound engineering loop applied to AI configuration. Each interaction improves the system. The complexity of your codebase grows, but so does the AI's ability to navigate it.

---

## Extending the Framework

Now that you understand how things work, here's how to add to them.

### Adding a Skill

1. Create the directory and SKILL.md:
```
.factory/skills/my-skill/SKILL.md
```

2. Write the frontmatter with trigger phrases:
```yaml
---
name: my-skill
description: Does X when user says "trigger phrase" or "another trigger"
---
```

3. Write instructions for what the skill should do.

4. It's automatically available in both tools (via symlink).

### Adding a Droid/Agent

**For Factory Droid users:**

1. Create the droid file:
```
.factory/droids/my-droid.md
```

2. Write the frontmatter with model config:
```yaml
---
name: my-droid
description: When to use this droid
model: claude-sonnet-4-5-20250929  # or gpt-5.1-codex for code tasks
---
```

**For Claude Code users:**

1. Create the agent file:
```
.claude/agents/my-agent.md
```

2. Write the frontmatter (Claude models only):
```yaml
---
name: my-agent
description: When to use this agent
model: claude-sonnet-4-5-20250929
---
```

**If using both tools:**

1. Create in `.factory/droids/` first
2. Copy to `.claude/agents/`:
```bash
cp .factory/droids/my-droid.md .claude/agents/my-droid.md
```
3. Edit `.claude/agents/my-droid.md` to replace any `gpt-5.1-codex` with `claude-sonnet-4-5-20250929`

### Adding a Command

1. Create the command file:
```
.factory/commands/my-command.md
```

2. Write the frontmatter:
```yaml
---
description: What this command does
argument-hint: <optional args>
---
```

3. Write instructions. Use `$ARGUMENTS` to access user input.

4. It's automatically available in both tools (via symlink).

### Naming Conventions

- All names: lowercase with hyphens (`my-skill`, not `mySkill`)
- Skills: folder name matches skill name
- Droids/Commands: filename matches name (without `.md`)

---

## When to Use What

This decision tree helps:

**Use a skill when:**
- The behavior should be automatic
- It's triggered by natural conversation
- It's part of a standard workflow (committing, documenting)

**Use a droid when:**
- The task needs specialized prompting
- It benefits from running in parallel with other tasks
- It's computationally heavy (full codebase analysis)
- Different models would perform better

**Use a command when:**
- The user should explicitly choose to run it
- It orchestrates multiple droids
- It needs arguments from the user

---

## What's Next

This framework is infrastructure, not a finished product. The specific skills, droids, and commands will evolve as we learn what works. The patterns—automatic behaviors, specialized subagents, explicit commands, compounding context—are what matter.

Start by using it as-is. Pay attention to friction. When you find yourself repeating work, that's a signal to add a skill. When you need specialized analysis, that's a signal to add a droid. When you want a one-click workflow, that's a signal to add a command.

The goal isn't to configure your AI perfectly upfront. It's to build a system that gets better every time you use it.

---

## Appendix: File Reference

### Skills (auto-invoked)
| Skill | Trigger | Purpose |
|-------|---------|---------|
| pre-commit | "commit this", "ready to commit" | Format & type-check before commits |
| compound-docs | "that worked", "it's fixed" | Document solved problems |
| changelog | "create PR", "make PR" | Generate changelog for PRs |
| sync-docs | (detects staged config files) | Update docs when config changes |
| linear | Linear-related requests | Issue management |
| simplicity-check | Before complex implementations | Prevent over-engineering |
| agentic-config | Asks about framework | Guide for extending |

### Droids (subagents)
| Droid | Model | Purpose |
|-------|-------|---------|
| codebase-analyzer | Sonnet | Understand repo structure |
| quick-checker | Haiku | Fast initial review pass |
| rust-reviewer | Codex | Rust code review |
| rust-reviewer-opus | Opus | Rust review (second perspective) |
| typescript-reviewer | Codex | TS/React code review |
| typescript-reviewer-opus | Opus | TS review (second perspective) |
| security-reviewer | Opus | Security analysis |
| architecture-reviewer | Opus | Design & structure review |
| review-coordinator | Opus (high) | Synthesize review findings |
| performance-reviewer | Sonnet | Performance analysis |
| git-history-analyzer | Sonnet | Understand code evolution |
| linear-search | Sonnet | Search Linear issues |
| best-practices-researcher | Codex | Research external patterns |
| code-simplicity-reviewer | Sonnet | YAGNI enforcement |

### Commands (explicit actions)
| Command | Purpose |
|---------|---------|
| /plan | Generate implementation plan |
| /review | Full code review pipeline |
| /stage-and-review | Stage changes then review |
| /analyze | Analyze codebase structure |
| /linear | Linear issue management |
| /changelog | Generate changelog |
| /compound | Document a solution |

---

*This document itself is part of the compound engineering loop. If you find ways to improve it, that improvement benefits everyone who uses the framework after you.*
