---
name: sync-docs
description: Update documentation and tutorial when committing changes to .factory or .claude. Auto-invoke when user commits changes that include config files (skills, droids, commands).
---

# Sync Docs Skill

Keep documentation in sync with agentic config changes.

## When to Activate
- User commits changes that include files in `.factory/` or `.claude/`
- User says "update docs", "sync documentation", "update tutorial"
- After creating/modifying skills, droids, or commands

## Detection Logic
Before committing, check staged files:
```bash
git diff --cached --name-only | grep -E '^\.(factory|claude)/'
```

If matches found, spawn documentation updater.

## Actions

### Spawn docs-updater subagent with this prompt:

```
Review the recent changes to agentic config files and update documentation accordingly.

## Files to Update
1. `docs/tutorial.md` - User-facing tutorial with examples
2. `README.md` - Quick overview if structure changed significantly

## What Changed
[Include the git diff of .factory/ and .claude/ changes]

## Update Guidelines

### For new commands:
- Add to Commands Reference table in tutorial
- Add usage example in Workflow Scenarios if relevant

### For new skills:
- Document trigger phrases in tutorial
- Add to Component Interaction section if it spawns subagents

### For new droids:
- Add to subagents table if user-facing
- Update Model Strategy table if relevant to reviews

### For structural changes:
- Update Architecture diagram
- Update directory tree examples

## Output
Summarize what was updated and why.
```

## Workflow
1. Detect config changes in staged files
2. Get diff of the changes
3. Spawn subagent to update docs
4. Report what documentation was updated
