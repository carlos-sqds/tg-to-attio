---
description: Run tests for the project - detects language and runs appropriate test command
argument-hint: [file-or-pattern]
---

# Run Tests

Run tests for the project or specific files.

## Scope
If `$ARGUMENTS` is provided, run tests matching that pattern.
Otherwise, run the full test suite.

## Detection & Execution

### Rust Project (Cargo.toml present)
```bash
# Full suite
cargo test

# Specific test
cargo test $ARGUMENTS

# With output
cargo test -- --nocapture
```

### TypeScript Project (package.json present)
```bash
# Full suite
pnpm test

# Specific file
pnpm test $ARGUMENTS

# Watch mode (if requested)
pnpm test --watch
```

### Both Languages
Run both test suites and report combined results.

## Output
- Show test results with pass/fail counts
- Highlight any failures with file locations
- Suggest fixes for common test failures
