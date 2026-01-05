# Implementation Plan: Missing Features from Compound Engineering

Based on analysis of [compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin), here's what we should add and why.

---

## Priority 1: Knowledge Compounding System

### Why This Matters
The core philosophy: **"Each unit of engineering work should make subsequent units easier—not harder."** 

When you solve a problem, document it immediately. Next time = 2 min lookup instead of 30 min research.

### Components to Build

#### 1.1 `/compound` Command
**Purpose:** Document solved problems while context is fresh

**Reference:** [compound.md](https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/commands/workflows/compound.md)

**Location:** `.factory/commands/compound.md`

**Key Features:**
- Auto-triggers on phrases like "that worked", "it's fixed"
- Orchestrates multiple droids in parallel:
  - Context Analyzer → extracts problem details
  - Solution Extractor → captures fix with code examples
  - Category Classifier → determines where to file it
  - Documentation Writer → creates the file
- Creates `docs/solutions/[category]/[filename].md`

#### 1.2 `compound-docs` Skill  
**Purpose:** The underlying capability for documentation capture

**Reference:** [compound-docs/SKILL.md](https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/skills/compound-docs/SKILL.md)

**Location:** `.factory/skills/compound-docs/SKILL.md`

**Key Features:**
- YAML frontmatter schema for searchability
- Category-based organization (performance-issues/, security-issues/, etc.)
- Cross-referencing similar issues
- Decision menu after capture (continue, add to patterns, link issues)

---

## Priority 2: Research Agents

### Why These Matter
Research before implementation = better decisions. These agents gather context so you don't reinvent the wheel.

### Agents to Build

#### 2.1 `best-practices-researcher`
**Purpose:** Research external best practices before implementing

**Reference:** [best-practices-researcher.md](https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/agents/research/best-practices-researcher.md)

**Location:** `.factory/droids/best-practices-researcher.md`

**Key Features:**
- Uses WebSearch to find current best practices
- Synthesizes from multiple sources
- Categorizes: Must Have / Recommended / Optional
- Cites sources with authority levels

**Model:** `gpt-5.1-codex` (good at synthesis)

#### 2.2 `git-history-analyzer`
**Purpose:** Understand code evolution and why things are the way they are

**Reference:** [git-history-analyzer.md](https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/agents/research/git-history-analyzer.md)

**Location:** `.factory/droids/git-history-analyzer.md`

**Key Features:**
- `git log --follow` for file history
- `git blame -w -C -C -C` for code origins
- `git shortlog -sn` for contributor mapping
- Pattern recognition in commit messages

**Model:** `sonnet` (good at analysis)

#### 2.3 `codebase-analyzer`
**Purpose:** Understand repo structure and conventions before making changes

**Location:** `.factory/droids/codebase-analyzer.md`

**Key Features:**
- Analyze directory structure
- Identify patterns and conventions
- Find similar implementations to reference
- Map dependencies

**Model:** `sonnet`

---

## Priority 3: Automation Hooks

### Why These Matter
Hooks = deterministic behavior. Don't rely on the model remembering to format or test.

### Hooks to Configure

**Reference Docs:**
- [Factory Hooks Guide](https://docs.factory.ai/cli/configuration/hooks-guide)
- [Auto-formatting Hooks](https://docs.factory.ai/guides/hooks/auto-formatting)
- [Testing Automation](https://docs.factory.ai/guides/hooks/testing-automation)
- [Code Validation](https://docs.factory.ai/guides/hooks/code-validation)

#### 3.1 Auto-Format on Edit
**Location:** `.factory/settings.json` (hooks section)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$FACTORY_PROJECT_DIR\" && file_path=$(jq -r '.tool_input.file_path') && case \"$file_path\" in *.rs) cargo fmt -- \"$file_path\" 2>/dev/null || true ;; *.ts|*.tsx) npx prettier --write \"$file_path\" 2>/dev/null || true ;; esac"
          }
        ]
      }
    ]
  }
}
```

#### 3.2 Type Check on Edit
```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command", 
      "command": "cd \"$FACTORY_PROJECT_DIR\" && file_path=$(jq -r '.tool_input.file_path') && case \"$file_path\" in *.ts|*.tsx) npx tsc --noEmit \"$file_path\" 2>&1 || true ;; *.rs) cargo check 2>&1 || true ;; esac"
    }
  ]
}
```

#### 3.3 Run Related Tests
```json
{
  "matcher": "Edit",
  "hooks": [
    {
      "type": "command",
      "command": "cd \"$FACTORY_PROJECT_DIR\" && file_path=$(jq -r '.tool_input.file_path') && case \"$file_path\" in *.ts|*.tsx) pnpm test --findRelatedTests \"$file_path\" --passWithNoTests 2>/dev/null || true ;; *.rs) cargo test 2>/dev/null || true ;; esac"
    }
  ]
}
```

---

## Priority 4: MCP Servers

### Why These Matter
External tools = expanded capabilities without custom code.

### Servers to Add

#### 4.1 Context7 (Framework Docs)
**Purpose:** Look up documentation for 100+ frameworks

**Reference:** [Context7 MCP](https://mcp.context7.com)

**Add to `.factory/mcp.json`:**
```json
{
  "context7": {
    "type": "http",
    "url": "https://mcp.context7.com/mcp"
  }
}
```

**Tools provided:**
- `resolve-library-id` - Find library ID
- `get-library-docs` - Get documentation

#### 4.2 Playwright (Browser Automation)
**Purpose:** Test UIs, take screenshots, automate browser tasks

**Add to `.factory/mcp.json`:**
```json
{
  "playwright": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@playwright/mcp@latest"]
  }
}
```

**Tools provided:**
- `browser_navigate`, `browser_click`, `browser_fill_form`
- `browser_take_screenshot`, `browser_snapshot`
- `browser_evaluate` (execute JS)

---

## Priority 5: Additional Review Agents

### Agents to Add

#### 5.1 `code-simplicity-reviewer`
**Purpose:** YAGNI enforcement, minimalism check

**Reference:** [code-simplicity-reviewer.md](https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/agents/review/code-simplicity-reviewer.md)

**Key Questions:**
- Is every line necessary?
- Can this be simpler?
- Are there premature abstractions?

#### 5.2 `performance-reviewer`
**Purpose:** Identify performance issues before they ship

**Focus Areas:**
- N+1 queries
- Unnecessary allocations
- Async/blocking issues
- Bundle size (frontend)

---

## Priority 6: Workflow Commands

### Commands to Add

#### 6.1 `/changelog`
**Purpose:** Generate changelog from recent commits

#### 6.2 `/deepen-plan`
**Purpose:** Enhance plans with parallel research

**How it works:**
1. Take existing plan
2. For each section, spawn research agent
3. Gather best practices, examples, considerations
4. Merge findings back into plan

---

## Implementation Order

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| **1** | `/compound` + `compound-docs` skill | 2-3h | High - core philosophy |
| **2** | Research droids (best-practices, git-history) | 1-2h | High - better decisions |
| **3** | Hooks (format, typecheck, test) | 1h | High - consistency |
| **4** | MCP servers (context7, playwright) | 30m | Medium - expanded tools |
| **5** | Additional reviewers (simplicity, performance) | 1h | Medium - code quality |
| **6** | Workflow commands (changelog, deepen-plan) | 1h | Low - nice to have |

---

## File Locations Summary

```
.factory/
├── commands/
│   ├── compound.md          # NEW - document solved problems
│   ├── changelog.md         # NEW - generate changelogs
│   └── deepen-plan.md       # NEW - enhance plans
├── droids/
│   ├── best-practices-researcher.md  # NEW
│   ├── git-history-analyzer.md       # NEW
│   ├── codebase-analyzer.md          # NEW
│   ├── code-simplicity-reviewer.md   # NEW
│   └── performance-reviewer.md       # NEW
├── skills/
│   └── compound-docs/
│       ├── SKILL.md                  # NEW
│       └── references/
│           └── schema.md             # YAML schema for docs
├── hooks/
│   └── (configured via /hooks or settings.json)
├── mcp.json                 # ADD context7, playwright
└── settings.json            # ADD hooks config

docs/
└── solutions/               # NEW - captured knowledge
    ├── performance-issues/
    ├── security-issues/
    ├── build-errors/
    └── patterns/
        └── common-solutions.md
```

---

## Next Steps

1. **Approve this plan** or request modifications
2. **Start with Phase 1** - the compounding system is the core value
3. **Iterate** - add more as needed

Which phase should I implement first?
