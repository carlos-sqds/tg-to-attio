---
name: compound
description: Document a recently solved problem to compound your team's knowledge
argument-hint: "[optional: brief context about the fix]"
---

# /compound

Document solutions while context is fresh. Each solved problem becomes reusable knowledge.

**Why "compound"?** Each documented solution compounds your team's knowledge. First time = research (30 min). Document it, next time = quick lookup (2 min).

## Trigger Patterns
Auto-suggest when detecting: "that worked", "it's fixed", "solved it", "figured it out"

## Usage
```
/compound                    # Document the most recent fix
/compound [brief context]    # Provide additional context
```

## Workflow

1. **Analyze Context** - Review conversation for:
   - What problem was being solved
   - What errors/symptoms appeared
   - What solution worked

2. **Extract Solution** - Capture:
   - Root cause
   - Fix with code examples
   - Why it works

3. **Classify Category** - Determine type:
   - `performance-issues/` - Speed, memory, N+1 queries
   - `security-issues/` - Auth, injection, data exposure
   - `build-errors/` - Compilation, bundling, dependencies
   - `api-issues/` - Endpoints, schemas, integrations
   - `database-issues/` - Migrations, queries, connections
   - `testing-issues/` - Test failures, flaky tests
   - `patterns/` - Reusable patterns and approaches

4. **Create Documentation** - Write to `docs/solutions/[category]/[filename].md`

## Output Format

```markdown
---
title: [Descriptive title]
category: [category]
tags: [relevant, tags]
created: [ISO date]
symptoms: [what user experienced]
---

# [Title]

## Problem
[What went wrong]

## Symptoms
- [Observable issues]

## Root Cause
[Why it happened]

## Solution
[How to fix it]

## Code Example
```[language]
[working code]
```

## Prevention
[How to avoid in future]

## Related
- [Links to similar issues]
```

## After Capture
Offer menu:
1. Continue working
2. Add to AGENTS.md patterns
3. Create Linear issue for related work
4. Link to existing documentation
