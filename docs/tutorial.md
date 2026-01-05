# Agentic Coding Framework Tutorial

> A unified configuration for AI-assisted development that works with both **Factory Droid** and **Claude Code**.

## Quick Start

| I want to... | Command |
|:-------------|:--------|
| Plan a feature before coding | `/plan <description>` |
| Work with Linear issues | `/linear <issue-id or action>` |
| Run multi-model code review | `/review [files]` |
| Stage all and review | `/stage-and-review` |
| Document a solved problem | `/compound` |

## Table of Contents

- [Framework Overview](#framework-overview)
- [Claude Code vs Factory Droid](#claude-code-vs-factory-droid)
- [Commands Reference](#commands-reference)
- [Workflow Scenarios](#workflow-scenarios)
- [Prompting Guide](#prompting-guide)
- [Advanced Topics](#advanced-topics)

> **Want to understand how this all works under the hood?** See [Behind the Scenes: How This Framework Actually Works](framework-guide.md) for a deep dive into the architecture, design philosophy, and how to extend the framework.

---

## Framework Overview

### What is the Agentic Coding Framework?

This framework provides a structured approach to AI-assisted development with:

- **Commands** - User-invoked actions via `/command-name`
- **Skills** - Auto-invoked capabilities based on task context
- **Droids/Agents** - Specialized subagents for specific tasks
- **MCP Integrations** - External tool connections (Linear, Playwright, etc.)

### Architecture

```
.factory/
├── commands/       # Slash commands (/plan, /linear, /review, etc.)
├── skills/         # Auto-invoked capabilities
├── droids/         # Specialized subagents
├── mcp.json        # External tool integrations
└── settings.json   # Configuration

.shared/            # Shared context files
├── context.md      # Project info, build commands
├── linear-workflow.md  # Linear integration patterns
└── [language]-patterns.md  # Language-specific conventions
```

### Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN AGENT                                 │
│  (Factory Droid / Claude Code)                                  │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│   │  /commands  │  │   skills    │  │    .shared/         │    │
│   │  (explicit) │  │   (auto)    │  │    context          │    │
│   └──────┬──────┘  └──────┬──────┘  └─────────────────────┘    │
│          │                │                                     │
└──────────┼────────────────┼─────────────────────────────────────┘
           │                │
           ▼                ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  SUBAGENTS       │  │   MCP SERVERS    │  │   EXTERNAL       │
│  (droids/agents) │  │                  │  │   TOOLS          │
│                  │  │  • Linear        │  │                  │
│  • codebase-     │  │  • Playwright    │  │  • git           │
│    analyzer      │  │  • Context7      │  │  • gh CLI        │
│  • reviewers     │  │                  │  │  • build tools   │
│  • researchers   │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Claude Code vs Factory Droid

This framework works with both tools. Key differences:

| Feature | Factory Droid | Claude Code |
|---------|---------------|-------------|
| Model support | Claude, GPT, Codex | Claude only |
| Subagents | "Droids" in `.factory/droids/` | "Agents" in `.claude/agents/` |
| Hooks | ✓ | ✗ |

**For Claude Code users:**
- Commands and skills work identically (symlinked from `.factory/`)
- Agents are in `.claude/agents/` with Claude-compatible models
- Dual-model reviews use Claude for both perspectives (still effective!)
- Ignore any hook-related documentation

> **Terminology**: This tutorial uses "droids" as shorthand - Claude Code users can read this as "agents".

### Command vs Skill Invocation

```
COMMAND (explicit)                    SKILL (automatic)
──────────────────                    ─────────────────

User types: /review                   User says: "commit this"
      │                                     │
      ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│ Load command MD │                  │ Agent detects   │
│ from .factory/  │                  │ trigger phrase  │
│ commands/       │                  │ from SKILL.md   │
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐
│ Execute steps   │                  │ Auto-invoke     │
│ (spawn droids,  │                  │ skill inline    │
│ run tools)      │                  │ (no user action)│
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐
│ Return result   │                  │ Continue with   │
│ to user         │                  │ main workflow   │
└─────────────────┘                  └─────────────────┘
```

### When to Use What

| Scenario | Use |
|----------|-----|
| Starting new work | `/plan` or `/linear start ABC-123` |
| Before committing | `/review` |
| After solving a tricky problem | `/compound` |
| Need specialized analysis | Spawn a droid directly |

---

## Commands Reference

### `/stage-and-review`

**Purpose**: Stage all changes and run comprehensive code review in one step.

**When to use:**
- Quick commit workflow - stage everything and review
- You know all changes are ready and want to review before committing
- Convenience wrapper for `git add -A && /review`

<details>
<summary><strong>Example usage</strong></summary>

```shell
/stage-and-review
# Stages ALL changes (including untracked files)
# Then runs full review pipeline
```

</details>

**What happens:**
1. Runs `git add -A` to stage all changes
2. Executes the full `/review` pipeline on staged changes

**Note**: This stages ALL changes including untracked files. If you want selective staging, use `git add <files>` manually then run `/review`.

---

### `/plan <task-description>`

**Purpose**: Create a detailed implementation plan before writing code.

**When to use:**
- Starting a new feature
- Complex refactoring
- When you need to think through an approach
- Before diving into unfamiliar code

<details>
<summary><strong>Example prompts</strong></summary>

```
/plan Add user authentication with JWT tokens

/plan Refactor the payment processing module to support multiple providers

/plan Create a caching layer for the API to reduce database load
```

</details>

**What happens:**
1. Agent analyzes requirements and scope
2. Researches existing code patterns
3. Produces structured plan with:
   - Requirements checklist
   - Implementation steps with estimates
   - Files to modify/create
   - Testing strategy
   - Risks and mitigations

**Output example**:
```markdown
# Plan: Add JWT Authentication

## Overview
Implement JWT-based authentication for API endpoints.

## Implementation Steps
1. **Add auth dependencies** (15min)
   - Files: `Cargo.toml`
   - Add: jsonwebtoken, argon2

2. **Create auth middleware** (1h)
   - Files: `src/middleware/auth.rs`
   - Changes: JWT validation, user extraction
   ...
```

**After planning**, you're offered options:
1. Refine the plan
2. Start implementation
3. Save the plan to `.factory/docs/`

---

### `/linear <issue-id or action>`

**Purpose:** Work with Linear issues - fetch, start, update, or create.

**When to use:**
- Starting work on an assigned issue
- Checking issue details
- Creating new issues from code discoveries
- Updating issue status

**Actions:**

| Input | Action |
|-------|--------|
| `ABC-123` | Fetch and display issue details |
| `start ABC-123` | Create branch, set status to In Progress |
| `done ABC-123` | Update status to Done |
| `review ABC-123` | Update status to In Review |
| `create <title>` | Create a new issue |

<details>
<summary><strong>Example prompts</strong></summary>

```shell
/linear ABC-123
# Shows: title, description, status, assignee, labels

/linear start ABC-123
# Creates: feat/ABC-123-issue-title branch
# Updates: status to "In Progress"

/linear create Add rate limiting to public API endpoints
# Prompts for: description, labels, priority
# Returns: new issue ID
```

</details>

**Lifecycle example:**

```
1. /linear start ABC-123
   → Branch created: feat/ABC-123-add-auth
   → Issue status: In Progress

2. [do your work, make commits]

3. Create PR with "Fixes ABC-123" in description
   → Issue auto-links to PR
   → On merge: Issue auto-closes
```

---

### `/review [files-or-directory]`

**Purpose:** Run comprehensive multi-model code review with specialized droids.

**When to use:**
- Before opening a PR
- After significant changes
- When you want expert analysis on security, architecture, or performance

<details>
<summary><strong>Example prompts</strong></summary>

```shell
/review
# Reviews staged git changes

/review src/auth/
# Reviews all files in auth directory

/review src/handlers/payment.rs src/models/transaction.rs
# Reviews specific files
```

</details>

**Review Pipeline:**

| Phase | Droid | Model | Focus |
|-------|-------|-------|-------|
| 1 | quick-checker | Haiku | Fast initial sweep - style, TODOs, debug code |
| 2a | rust-reviewer | Codex* | Rust idioms, error handling, Axum patterns |
| 2a | rust-reviewer-opus | Opus | Rust idioms (Opus perspective) |
| 2b | typescript-reviewer | Codex* | Type safety, React patterns, NextJS |
| 2b | typescript-reviewer-opus | Opus | Type safety (Opus perspective) |
| 2c | security-reviewer | Opus | Vulnerabilities, auth, injection, secrets |
| 2d | architecture-reviewer | Opus | Design patterns, coupling, maintainability |
| 3 | review-coordinator | Opus | Synthesizes findings, resolves conflicts |

*\*Codex in Factory Droid, Sonnet in Claude Code*

**Note**: Rust and TypeScript files are reviewed by two models in parallel for dual-perspective coverage. In Factory Droid this means Codex + Opus; in Claude Code both use Claude models but with different prompting strategies.

**Output format:**

```markdown
## Final Review Decision: REQUEST CHANGES

### Critical Issues
| Issue | File | Line | Recommendation |
|-------|------|------|----------------|
| SQL injection risk | query.rs | 45 | Use parameterized queries |

### Important Issues
...

### Suggestions
...

### Action Items
1. [ ] Fix SQL injection in query.rs:45
2. [ ] Add input validation for email field
```

---

### `/compound [context]`

**Purpose:** Document a recently solved problem to compound team knowledge.

**When to use:**
- Right after fixing a tricky bug
- When you say "that worked!" or "figured it out"
- After debugging sessions
- When solving something you'll likely encounter again

<details>
<summary><strong>Example prompts</strong></summary>

```shell
/compound
# Documents the most recent fix from conversation

/compound the CORS issue with the staging environment
# Documents with additional context provided
```

</details>

**What gets captured:**
- Problem description
- Symptoms/errors observed
- Root cause analysis
- Solution with code examples
- Prevention strategies

**Output location:** `docs/solutions/[category]/[filename].md`

**Categories:**
- `performance-issues/`
- `security-issues/`
- `build-errors/`
- `api-issues/`
- `database-issues/`
- `testing-issues/`
- `patterns/`

**After documenting**, you're offered:
1. Continue working
2. Add to AGENTS.md patterns
3. Create Linear issue for related work
4. Link to existing documentation

---

## Workflow Scenarios

### Scenario 1: Linear Issue to Pull Request

> The most common workflow - taking an assigned issue through to completion.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    LINEAR ISSUE → PULL REQUEST FLOW                      │
└──────────────────────────────────────────────────────────────────────────┘

  LINEAR                    LOCAL DEV                      GITHUB
  ──────                    ─────────                      ──────

┌─────────┐
│ ABC-123 │
│ To Do   │
└────┬────┘
     │
     │  /linear start ABC-123
     ▼
┌─────────┐           ┌─────────────────────┐
│ ABC-123 │           │ git checkout -b     │
│In Progr.│◄─────────►│ feat/ABC-123-...    │
└────┬────┘           └──────────┬──────────┘
     │                           │
     │                           │  [implement]
     │                           │  /plan → code → /review
     │                           ▼
     │                ┌─────────────────────┐
     │                │ git commit          │
     │                │ git push            │
     │                └──────────┬──────────┘
     │                           │
     │                           │  gh pr create
     │                           ▼
┌─────────┐           │          │         ┌─────────────┐
│ ABC-123 │◄──────────┼──────────┼────────►│  PR #42     │
│In Review│  auto-link│          │         │"Fixes ABC-  │
└────┬────┘           │          │         │  123"       │
     │                           │         └──────┬──────┘
     │                           │                │
     │                           │                │  [merge]
     │                           │                ▼
┌─────────┐                                ┌─────────────┐
│ ABC-123 │◄───────────────────────────────│  main       │
│  Done   │           auto-close           │  updated    │
└─────────┘                                └─────────────┘
```

**Step 1: Find and start your issue**
```
/linear start ABC-123
```

Output:
```
Created branch: feat/ABC-123-implement-user-search
Updated ABC-123 status: In Progress

Issue: Implement user search API
Description: Add endpoint to search users by name or email...
Labels: feature, backend
```

**Step 2: Understand the codebase** (if needed)

For unfamiliar areas, the agent can spawn a codebase-analyzer:
```
Help me understand the existing API structure before I add the search endpoint
```

**Step 3: Plan the implementation**
```
/plan implement user search with the patterns shown in the existing API
```

**Step 4: Implement with guidance**

Work iteratively with the agent:
```
Let's start with step 1 from the plan - create the search handler
```

**Step 5: Review before committing**
```
/review src/handlers/user_search.rs src/routes/mod.rs
```

**Step 6: Create the PR**
```
Create a PR for this change. Include "Fixes ABC-123" in the description.
```

The PR description will include:
```markdown
## Summary
Implements user search API with name and email filtering.

## Changes
- Added `/api/users/search` endpoint
- Added `UserSearchQuery` type with validation
- Added search service with pagination

Fixes ABC-123
```

**Step 7: On merge**
- PR merges to main
- Linear automatically moves ABC-123 to "Done"

---

### Scenario 2: Idea to Linear Issue

When you have an idea or discover something that needs work.

**From a code discovery**:
```
I found a performance issue in the query at src/db/users.rs:45 - 
it's doing N+1 queries. Create a Linear issue for this.

/linear create Fix N+1 query in user loader
```

The agent will:
1. Gather context from the conversation
2. Create a well-structured issue with:
   - Clear title
   - Description with file/line references
   - Appropriate labels (`tech-debt`, `performance`)
   - Suggested priority

**From a feature idea**:
```
/linear create Add dark mode support to the dashboard
```

You'll be prompted for:
- Detailed description
- Acceptance criteria
- Labels and priority

---

### Scenario 3: Full Code Review Workflow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        /REVIEW PIPELINE                                  │
└──────────────────────────────────────────────────────────────────────────┘

                              /review
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Quick Check (Haiku)                                          │
│  ─────────────────────────────                                         │
│  • Style issues, TODOs, debug code                                     │
│  • Returns in ~5 seconds                                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Specialized Reviews (parallel, dual-model for Rust/TS)       │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│ rust-        │ rust-        │ ts-          │ ts-          │ security-   │
│ reviewer     │ reviewer-    │ reviewer     │ reviewer-    │ reviewer +  │
│ (Codex)      │ opus         │ (Codex)      │ opus         │ arch-       │
│              │ (Opus)       │              │ (Opus)       │ reviewer    │
│ • Idioms     │ • Idioms     │ • Type safe  │ • Type safe  │ (both Opus) │
│ • Errors     │ • Errors     │ • React      │ • React      │             │
│ • Axum       │ • Axum       │ • NextJS     │ • NextJS     │             │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘
       │              │              │              │              │
       └──────────────┴──────────────┴──────────────┴──────────────┘
                                     │
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: Synthesis (review-coordinator, Opus)                         │
│  ─────────────────────────────────────────────                         │
│  • Deduplicate findings from dual models                               │
│  • Resolve conflicting recommendations                                 │
│  • Prioritize: Critical → Important → Suggestions                      │
│  • Generate action items checklist                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │  Final Report   │
                          │  with decision: │
                          │  APPROVE /      │
                          │  REQUEST CHANGES│
                          └─────────────────┘
```

**Before opening a PR:**

```shell
# Stage your changes
git add .

# Run the review
/review
```

**Understanding the output:**

1. **Quick Check** (immediate): Shows obvious issues fast
2. **Specialized Reviews** (parallel): Deep analysis by domain
3. **Synthesis** (final): Prioritized, deduplicated findings

**Responding to findings**:

```
Fix the critical issues identified in the review
```

Or address specific items:
```
Fix the SQL injection issue in query.rs:45 using parameterized queries
```

**Re-review after fixes**:
```
/review src/db/query.rs
```

---

### Scenario 4: Knowledge Capture After Debugging

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE CAPTURE FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

     DEBUGGING SESSION                        DOCUMENTATION
     ─────────────────                        ─────────────

┌─────────────────────────┐
│  Problem encountered    │
│  "CORS error despite    │
│   correct origin..."    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Investigation &        │
│  trial/error with       │
│  agent assistance       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  "That worked!"         │
│  Solution found         │
└───────────┬─────────────┘
            │
            │  /compound
            ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│  Agent extracts:        │          │  docs/solutions/        │
│  • Problem              │─────────►│  api-issues/            │
│  • Symptoms             │          │  cors-credentials.md    │
│  • Root cause           │          │                         │
│  • Solution + code      │          │  (YAML frontmatter +    │
│  • Prevention           │          │   searchable content)   │
└───────────┬─────────────┘          └─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  Future: Agent searches │
│  docs/solutions/ before │◄─────────  grep "CORS" docs/solutions/
│  investigating from     │
│  scratch                │
└─────────────────────────┘
```

After a debugging session that ends with success:

```
User: Finally! The CORS error was because of the missing credentials header.
Agent: Would you like to document this solution for future reference?
User: Yes, /compound
```

The agent creates `docs/solutions/api-issues/cors-credentials-header.md`:

```markdown
---
title: CORS Fails Despite Correct Origin
category: api-issues
tags: [cors, fetch, credentials]
created: 2024-01-15
symptoms: CORS error even with origin in allowed list
---

# CORS Fails Despite Correct Origin

## Problem
API requests fail with CORS errors even when the origin is correctly 
configured in the server's allowed origins.

## Symptoms
- Browser shows: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Server logs show the request never reaches the handler
- Works in Postman but fails in browser

## Root Cause
When using `credentials: 'include'` in fetch, the server must also
return `Access-Control-Allow-Credentials: true` header.

## Solution
Add credentials support to CORS configuration:

```rust
CorsLayer::new()
    .allow_origin(origins)
    .allow_credentials(true)  // This was missing
```

## Prevention
Always configure CORS credentials when using cookies or auth headers.
```

---

## Prompting Guide

### Effective Prompts

**Be specific about what you want**:

```
# Good
/plan Add pagination to the /api/posts endpoint using cursor-based pagination

# Less effective  
/plan Add pagination
```

**Provide context when relevant**:

```
# Good
/linear start ABC-123
Then show me similar implementations in the codebase before we start coding

# Less effective
/linear start ABC-123
Now implement it
```

**Chain commands for complex workflows**:

```
/plan implement the feature described in ABC-123
[review plan]
OK, start with step 1
[after implementation]
/review
[after review passes]
Create the PR
```

### Anti-Patterns to Avoid

| Don't | Instead |
|-------|---------|
| "Fix the bug" | "Fix the null pointer in user.rs:23 by adding a None check" |
| "Make it better" | "Improve performance by adding an index on user_id" |
| "Review everything" | `/review src/handlers/` or just `/review` for staged changes |
| Start coding immediately | `/plan` first for non-trivial features |

### When to Use Each Command

```
Ask yourself:
├── Starting new work?
│   ├── Have a Linear issue? → /linear start ABC-123
│   └── Need to plan first? → /plan <description>
│
├── Ready to commit?
│   └── /review (always before PR)
│
├── Just solved something tricky?
│   └── /compound
│
└── Found something that needs work?
    └── /linear create <title>
```

---

## Advanced Topics

### Using Droids/Agents Directly

Sometimes you want a specialized analysis without the full command workflow.

**Available subagents** (called "droids" in Droid, "agents" in Claude Code):

| Name | Use When |
|------|----------|
| `codebase-analyzer` | Onboarding to new code, before major changes |
| `best-practices-researcher` | Planning approach for new feature |
| `git-history-analyzer` | Understanding why code looks a certain way |
| `performance-reviewer` | Optimizing data-heavy operations |
| `linear-search` | Searching backlog without cluttering context |
| `rust-reviewer` | Rust-specific code review |
| `rust-reviewer-opus` | Rust code review (second perspective) |
| `typescript-reviewer` | TypeScript/React review |
| `typescript-reviewer-opus` | TypeScript review (second perspective) |
| `security-reviewer` | Security-focused analysis |
| `architecture-reviewer` | Architectural patterns and design |

**Invoking directly**:
```
Spawn the codebase-analyzer to map the authentication module
```

### MCP Integrations

The framework includes several MCP servers:

| Server | Purpose |
|--------|---------|
| `linear` | Issue management, search, updates |
| `playwright` | Browser automation for testing |
| `context7` | External documentation lookup |
| `factory-docs` | Factory Droid documentation |
| `claude-code-docs` | Claude Code documentation |

These are used automatically when relevant, but you can invoke them directly:
```
Use the Linear MCP to find all issues labeled "tech-debt" assigned to me
```

### Extending the Framework

To add new commands, skills, or droids, use the `agentic-config` skill:

```
I want to add a new command for generating changelog entries
```

The skill will guide you through:
- Correct file location and format
- Required frontmatter fields
- Syncing between Droid and Claude Code

See `.factory/skills/agentic-config/SKILL.md` for full documentation.

### Tips for Team Adoption

1. **Start with `/plan`** - Gets everyone thinking before coding
2. **Require `/review` before PRs** - Catches issues early
3. **Use `/compound` religiously** - Knowledge compounds over time
4. **Link everything to Linear** - Traceability matters

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DECISION TREE                                  │
└────────────────────────────────────────────────────────────────────────┘

                        What do you need?
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    Start work?         Ship code?         Capture knowledge?
          │                   │                   │
    ┌─────┴─────┐       ┌─────┴─────┐            │
    │           │       │           │            │
    ▼           ▼       ▼           ▼            ▼
Have issue?   New?   Ready?    Issues?      Solved bug?
    │           │       │           │            │
    ▼           ▼       ▼           ▼            ▼
/linear     /plan    /review    Fix them     /compound
start                           then
ABC-123                         /review

┌────────────────────────────────────────────────────────────────────────┐
│                         COMMANDS                                       │
├────────────────────────────────────────────────────────────────────────┤
│  /plan <desc>          Plan before coding                              │
│  /linear <id/action>   Linear issue workflow                           │
│  /review [files]       Multi-model review (dual Codex+Opus)            │
│  /stage-and-review     Stage all + run review                          │
│  /compound [context]   Document solutions                              │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                    LINEAR MAGIC WORDS (in PR desc)                     │
├────────────────────────────────────────────────────────────────────────┤
│  Fixes ABC-123      Links + closes on merge                            │
│  Closes ABC-123     Links + closes on merge                            │
│  Part of ABC-123    Links only                                         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                         BRANCH NAMING                                  │
├────────────────────────────────────────────────────────────────────────┤
│  feat/ABC-123-description                                              │
│  fix/ABC-123-description                                               │
│  chore/ABC-123-description                                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Getting Help

- **Framework config**: See `agentic-config` skill
- **Linear workflow**: See `.shared/linear-workflow.md`
- **Language patterns**: See `.shared/rust-patterns.md` or `.shared/typescript-patterns.md`
- **Command details**: See `.factory/commands/*.md`
