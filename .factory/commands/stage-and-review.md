---
description: Stage all changes and run multi-model code review
---

# Stage and Review

Stage all git changes, then run a comprehensive code review.

## Steps

1. **Stage changes**: Run `git add -A` to stage all changes
2. **Run review**: Follow the full `/review` command pipeline (quick-check → specialized reviewers → synthesis)

## Notes
- This stages ALL changes including untracked files
- If you want to stage specific files, use `git add <files>` manually then run `/review`
