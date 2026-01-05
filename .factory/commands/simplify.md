---
description: Check code for over-engineering and unnecessary complexity (YAGNI)
argument-hint: [file-or-directory]
---

# Simplicity Check

Review code for unnecessary complexity and over-engineering.

## Scope
- If `$ARGUMENTS` provided: review those files
- Otherwise: review staged changes (`git diff --staged`)

## Execution

Spawn `code-simplicity-reviewer` subagent to identify:
- YAGNI violations (features not needed yet)
- Over-abstraction and premature generalization
- Unnecessary indirection layers
- Simpler alternatives to current approach

## Output
- Complexity score
- Specific simplification opportunities
- "What's the least code that solves exactly what was asked?"
