---
name: linear
description: Linear issue management via MCP with GitHub integration. Use when creating/updating issues, querying backlog, starting work on issues, or linking commits/PRs to Linear.
---

# Linear Skill

This skill teaches effective use of the Linear MCP and GitHub integration for issue tracking.

## Prerequisites

Ensure `LINEAR_API_KEY` environment variable is set:
```bash
export LINEAR_API_KEY="lin_api_xxxxx"
```
Get your API key from: Linear Settings → API → Personal API keys

## MCP Tools Reference

The Linear MCP provides these core tools:

| Tool | Purpose |
|------|---------|
| `linear_search_issues` | Search issues by query, status, assignee |
| `linear_get_issue` | Get issue details by ID (e.g., `ABC-123`) |
| `linear_create_issue` | Create new issue with title, description, team |
| `linear_update_issue` | Update status, assignee, priority, labels |
| `linear_add_comment` | Add comment to an issue |
| `linear_get_teams` | List available teams |
| `linear_get_user` | Get current user info and assigned issues |

## Issue States

Standard workflow states (may vary by team):

```
Backlog → Todo → In Progress → In Review → Done
         ↓
      Canceled
```

## GitHub Integration

### Magic Words (in PR description or commits)

Use these keywords followed by issue ID to auto-link:

| Keyword | Effect |
|---------|--------|
| `Fixes ABC-123` | Links and closes issue when PR merges |
| `Closes ABC-123` | Links and closes issue when PR merges |
| `Resolves ABC-123` | Links and closes issue when PR merges |
| `Part of ABC-123` | Links without closing |
| `Related to ABC-123` | Links without closing |

### Branch Naming Convention

Create branches with issue ID for automatic linking:
```
feat/ABC-123-short-description
fix/ABC-123-bug-title
```

When creating a branch from Linear UI, it auto-generates this format.

### Automatic Status Updates

When GitHub integration is configured:

| GitHub Event | Linear Status Change |
|--------------|---------------------|
| Branch created from Linear | → In Progress |
| PR opened with linked issue | → In Progress (or In Review) |
| PR merged to main/master | → Done |
| PR closed without merge | No change |

Branch-specific rules can be configured in Linear → Settings → Integrations → GitHub.

## Workflow Patterns

### Searching Issues

For any search involving multiple queries or exploring the backlog, delegate to the `linear-search` droid:
```
Task: linear-search
Prompt: Find issues related to [topic/criteria]
```

This keeps search iterations out of the main context.

### Starting Work on an Issue

1. Query your assigned issues:
   ```
   Spawn linear-search droid to find assigned issues
   ```

2. Update status to "In Progress":
   ```
   Use linear_update_issue to set state
   ```

3. Create branch with issue ID:
   ```bash
   git checkout -b feat/ABC-123-description
   ```

### Committing with Links

Include issue ID in commit message:
```bash
git commit -m "Add user validation

Fixes ABC-123"
```

### Creating a PR

Include magic word in PR description:
```markdown
## Summary
Implements user validation for signup flow.

Fixes ABC-123
```

### Creating Issues from Code Context

When finding TODOs or bugs in code:
```
Use linear_create_issue with:
- title: Clear, actionable description
- description: Include file path, line numbers, context
- team: Appropriate team ID
- priority: 1 (urgent) to 4 (low)
```

### Querying Before Starting Work

Before implementing a feature:
```
1. Search for existing issues on the topic
2. Check for related/duplicate issues
3. Review any linked PRs or prior attempts
```

## Labels

Common labels (team-specific):
- `bug` - Defects and errors
- `feature` - New functionality
- `tech-debt` - Code improvements
- `urgent` - Needs immediate attention
- `blocked` - Waiting on dependency

## Best Practices

1. **Always link**: Every PR should reference a Linear issue
2. **Update status**: Move issues through states as work progresses
3. **Add context**: Comment on issues with findings, blockers, decisions
4. **Use priorities**: Help team triage with accurate priority levels
5. **Close the loop**: Verify issues auto-close after PR merge, manually close if needed
