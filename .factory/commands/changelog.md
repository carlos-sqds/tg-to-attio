---
name: changelog
description: Generate a changelog from recent commits
argument-hint: "[--since=<date>] [--format=markdown|json]"
---

# /changelog

Generate a changelog from recent commits.

## Usage
```
/changelog [options]
```

## Options
- `--since=<date>` - Start date (default: last tag or 2 weeks)
- `--until=<date>` - End date (default: now)
- `--format=<type>` - Output format: `markdown`, `json` (default: markdown)
- `--group` - Group by type (feat/fix/etc.)

## Process

1. **Gather Commits**
   ```bash
   git log --oneline --since="2 weeks ago"
   # Or since last tag
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```

2. **Parse Conventional Commits**
   Extract type from commit messages:
   - `feat:` → Features
   - `fix:` → Bug Fixes  
   - `docs:` → Documentation
   - `refactor:` → Refactoring
   - `test:` → Tests
   - `chore:` → Maintenance

3. **Generate Output**

## Output Format

```markdown
# Changelog

## [Unreleased] - YYYY-MM-DD

### Features
- feat: Add user authentication (#123)
- feat: Implement dark mode toggle

### Bug Fixes
- fix: Resolve memory leak in cache (#456)
- fix: Correct timezone handling

### Documentation
- docs: Update API reference

### Other
- refactor: Simplify error handling
- chore: Update dependencies
```

## Integration
After generating:
1. Review for accuracy
2. Add context where needed
3. Copy to CHANGELOG.md or release notes
