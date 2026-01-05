---
name: changelog
description: Generate changelog from git history and implementation context when creating PRs. Auto-invoke when user says "create PR", "make a PR", "open pull request", or "generate changelog".
---

# Changelog Skill

Generate a changelog that combines git commits, implementation context, and plan details.

## When to Activate
- User says "create PR", "make a PR", "open pull request"
- User says "generate changelog", "write changelog"
- Before finalizing a PR description

## Information Sources

### 1. Git Context
```bash
# Commits since branching from main/default
git log main..HEAD --oneline

# Files changed
git diff main..HEAD --stat

# Full diff for understanding scope
git diff main..HEAD --name-only
```

### 2. Implementation Context (from conversation)
- What was the original task/request?
- What approach was taken?
- What key decisions were made?
- What files were created/modified and why?

### 3. Plan Context
If a plan/spec was created during the session:
- Original goals from the plan
- Which items were completed
- Any deviations from the plan

## Output Format

```markdown
## Summary
[1-2 sentence high-level description of what this PR accomplishes]

## Changes

### Added
- [New features, files, capabilities]

### Changed
- [Modifications to existing behavior]

### Fixed
- [Bug fixes, corrections]

### Technical Details
- [Key implementation decisions]
- [Notable patterns or approaches used]

## Context
[Why this change was made - link to issue/discussion if available]

## Testing
- [How to verify the changes work]
- [Any manual testing performed]
```

## Workflow

1. **Gather Git Info**
   - Get commit list since branch diverged
   - Get changed files summary

2. **Recall Implementation Context**
   - Review the session's task/plan
   - Note key decisions and trade-offs
   - Identify the "why" behind changes

3. **Generate Changelog**
   - Combine git facts with context
   - Group by change type (Added/Changed/Fixed)
   - Include testing notes

4. **Output**
   - Present for user review
   - Offer to include in PR description

## Example Usage

When user says "create a PR":

1. Run git commands to get commit/diff info
2. Synthesize from conversation: task, plan, decisions
3. Generate changelog markdown
4. Ask user to review before creating PR
