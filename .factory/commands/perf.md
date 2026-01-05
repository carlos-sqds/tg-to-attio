---
description: Review code for performance issues before they ship
argument-hint: [file-or-directory]
---

# Performance Review

Review code for performance issues.

## Scope
- If `$ARGUMENTS` provided: review those files
- Otherwise: review staged changes (`git diff --staged`)

## Execution

Spawn `performance-reviewer` subagent to identify:
- N+1 queries and database issues
- Memory leaks and excessive allocations
- Unnecessary re-renders (React)
- Missing indexes or slow queries
- Opportunities for caching or batching

## Use Cases
- Before committing data-heavy code
- Reviewing latency-sensitive paths
- Investigating slowdowns
