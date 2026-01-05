# Linear Workflow

## Issue States
`Backlog` → `Todo` → `In Progress` → `In Review` → `Done`

## Branch Naming
From Linear issue ID: `feat/ABC-123-short-description` or `fix/ABC-123-bug-title`

## GitHub Integration Magic Words

Use in PR descriptions or commit messages to auto-link:
- `Fixes ABC-123` - Links and closes on merge
- `Closes ABC-123` - Links and closes on merge  
- `Resolves ABC-123` - Links and closes on merge
- `Part of ABC-123` - Links without closing

## Auto Status Updates (GitHub → Linear)

| GitHub Event | Linear Status |
|--------------|---------------|
| Branch created from Linear | → In Progress |
| PR opened | → In Progress / In Review |
| PR merged to main | → Done |

## PR Workflow
1. Create branch from Linear issue (auto-links and sets In Progress)
2. Implement with atomic commits
3. Open PR with `Fixes ABC-123` in description
4. PR review moves issue to "In Review" (if configured)
5. After merge, issue auto-moves to "Done"

## Commit Message Format
```
Short description

Longer explanation if needed.

Fixes ABC-123
```

## Labels
- `bug`, `feature`, `tech-debt`, `urgent`, `blocked`
