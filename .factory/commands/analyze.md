---
description: Understand codebase structure and conventions before making changes
argument-hint: [directory-or-focus-area]
---

# Analyze Codebase

Analyze the codebase to understand structure and conventions.

## Scope
- If `$ARGUMENTS` provided: focus on that directory or area
- Otherwise: analyze the entire repository

## Execution

Spawn `codebase-analyzer` subagent with the scope and return a summary of:
- Project structure and architecture
- Key patterns and conventions in use
- Dependencies and their purposes
- Entry points and main flows

## Use Cases
- Before implementing a new feature
- When onboarding to unfamiliar code
- Before significant refactoring
