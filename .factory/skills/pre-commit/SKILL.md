---
name: pre-commit
description: Run formatting and type-checking before git commits. Auto-invoke when user says "commit this", "ready to commit", or when about to run git commit.
---

# Pre-commit Skill

Run formatting and type-checking on staged files before committing.

## When to Activate
- User says "commit this", "ready to commit", "let's commit", "make a commit"
- About to run `git commit`
- User says "pre-commit", "format and check"

## Actions

### Format staged files
```bash
# Get staged files
staged=$(git diff --cached --name-only --diff-filter=ACMR)

# Format Rust files
echo "$staged" | grep -E '\.rs$' | xargs -r cargo fmt -- 2>/dev/null || true

# Format TypeScript/JavaScript files  
echo "$staged" | grep -E '\.(ts|tsx|js|jsx)$' | xargs -r npx prettier --write 2>/dev/null || true

# Re-stage formatted files
echo "$staged" | xargs -r git add
```

### Type check
```bash
# TypeScript - check if any TS files are staged
if git diff --cached --name-only | grep -qE '\.(ts|tsx)$'; then
  npx tsc --noEmit
fi

# Rust - check if any Rust files are staged
if git diff --cached --name-only | grep -qE '\.rs$'; then
  cargo check
fi
```

## Workflow
1. Run format on staged files
2. Run type check
3. Report any errors before proceeding with commit
