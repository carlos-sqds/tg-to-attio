---
description: Work with Linear issues - fetch details, update status, or create branches
argument-hint: <issue-id-or-action>
---

# Linear Integration

Work with Linear issues for: $ARGUMENTS

## Actions

### Fetch Issue Details
If given an issue ID (e.g., `ABC-123`):
1. Use Linear MCP/API to fetch issue details
2. Display: title, description, status, assignee, labels
3. Show related issues and comments

### Search Issues
If given a search query (e.g., `search auth bugs`):
1. Spawn `linear-search` subagent for complex queries
2. Return concise summary of matching issues

### Start Work on Issue
If given `start ABC-123`:
1. Fetch issue details
2. Create branch: `feat/ABC-123-<slugified-title>`
3. Update issue status to "In Progress"
4. Display issue context for implementation

### Update Status
If given `done ABC-123` or `review ABC-123`:
1. Update the issue status accordingly
2. Add a comment with summary of changes if PR exists

### Create Issue
If given `create <title>`:
1. Ask for description and labels
2. Create issue in Linear
3. Return issue ID

## Branch Naming Convention
- Features: `feat/ABC-123-short-description`
- Bugs: `fix/ABC-123-short-description`
- Tech debt: `chore/ABC-123-short-description`

## Notes
Requires Linear MCP server to be configured in `.factory/mcp.json`.
If not available, provide manual instructions for Linear web interface.
