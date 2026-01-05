---
name: compound-docs
description: Capture solved problems as categorized documentation with YAML frontmatter for fast lookup. Use after solving non-trivial problems when user says "that worked", "it's fixed", or similar confirmation phrases.
---

# compound-docs Skill

Automatically document solved problems to build searchable institutional knowledge.

## When to Activate
- After phrases like "that worked", "it's fixed", "working now", "problem solved"
- When explicitly asked to document a solution
- Non-trivial problems only (skip simple typos or obvious fixes)

## 7-Step Process

### Step 1: Detect Confirmation
Auto-invoke after confirmation phrases. Skip trivial fixes.

### Step 2: Gather Context
Extract from conversation:
- **Symptom**: Observable error/behavior (exact messages)
- **Investigation attempts**: What didn't work
- **Root cause**: Technical explanation
- **Solution**: What fixed it (with code)
- **Stack**: [rust, axum] or [typescript, nextjs]

If critical context missing, ask and wait before proceeding.

### Step 3: Check Existing Docs
Search `docs/solutions/` for similar issues:
```bash
grep -r "error phrase" docs/solutions/
```

If found, offer: (1) Create new with cross-reference, (2) Update existing, (3) Other

### Step 4: Generate Filename
Format: `[sanitized-symptom]-[YYYYMMDD].md`
- Lowercase, hyphens for spaces, no special chars, <80 chars

### Step 5: Validate YAML Schema
Required frontmatter:
```yaml
---
title: string           # Descriptive, searchable
category: string        # Folder category (see below)
tags: [string]          # For filtering
created: ISO-date
symptoms: [string]      # What user experienced
root_cause: string      # Why it happened
stack: [string]         # e.g., [rust, axum]
severity: critical|moderate|minor
---
```

### Step 6: Create Documentation
Categories and their mappings:
| Category | Use For |
|----------|---------|
| `performance-issues` | Speed, memory, N+1 queries, bundle size |
| `security-issues` | Auth, injection, data exposure, CORS |
| `build-errors` | Compilation, bundling, dependencies |
| `api-issues` | Endpoints, schemas, integrations |
| `database-issues` | Migrations, queries, connections |
| `testing-issues` | Test failures, flaky tests, mocking |
| `patterns` | Reusable approaches and solutions |

Create file at `docs/solutions/[category]/[filename].md`

### Step 7: Cross-Reference
Link related docs if similar issues found.

## Decision Menu After Capture

```
✓ Solution documented
File: docs/solutions/[category]/[filename].md

What's next?
1. Continue workflow (recommended)
2. Add to AGENTS.md patterns
3. Link related issues
4. View documentation
5. Other
```

## Quality Guidelines

**Good documentation has:**
- Exact error messages (copy-paste)
- Specific file:line references
- Observable symptoms
- Failed attempts documented
- Code examples (before/after)
- Prevention guidance

**Avoid:**
- Vague descriptions
- No technical details
- Just code dumps without explanation
