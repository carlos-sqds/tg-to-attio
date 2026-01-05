---
description: Run multi-model code review with specialized droids and synthesis
argument-hint: [file-or-directory]
---

# Multi-Model Code Review

Run a comprehensive code review using multiple specialized droids with different models, then synthesize findings.

## Scope
- If `$ARGUMENTS` provided: review those specific files/directories
- Otherwise: review staged git changes (`git diff --staged`)

## Review Pipeline

### Phase 1: Quick Check (Haiku - Fast)
Run `quick-checker` droid for fast initial sweep:
- Style issues, obvious bugs, TODOs, debug statements
- Provides quick feedback while other reviewers run

### Phase 2: Specialized Reviews (Parallel)
Based on file types detected, run in parallel with **dual-model coverage**:

**For Rust files (.rs):**
- `rust-reviewer` (Codex) - Idiomatic Rust, error handling, Axum patterns
- `rust-reviewer-opus` (Opus) - Same focus, different model perspective

**For TypeScript files (.ts, .tsx):**
- `typescript-reviewer` (Codex) - Type safety, React patterns, NextJS
- `typescript-reviewer-opus` (Opus) - Same focus, different model perspective

**For all code:**
- `security-reviewer` (Opus) - Vulnerabilities, auth, injection, secrets
- `architecture-reviewer` (Opus) - Design patterns, coupling, maintainability
- `agent-ready-reviewer` (Sonnet) - Explicit dependencies, searchability, static analysis friendliness

### Phase 3: Synthesis (Opus - High Reasoning)
Run `review-coordinator` droid with all findings:
- Aggregates and deduplicates issues
- Resolves conflicting recommendations
- Produces final decision and prioritized action items

## Model Strategy
| Droid | Model | Purpose |
|-------|-------|---------|
| quick-checker | Haiku | Fast, cheap initial pass |
| rust-reviewer | Codex | Rust review - Codex perspective |
| rust-reviewer-opus | Opus | Rust review - Opus perspective |
| typescript-reviewer | Codex | TS review - Codex perspective |
| typescript-reviewer-opus | Opus | TS review - Opus perspective |
| security-reviewer | Opus | Deep security analysis |
| architecture-reviewer | Opus | Complex structural reasoning |
| agent-ready-reviewer | Sonnet | Agent comprehension & modification |
| review-coordinator | Opus | Synthesis with dual perspectives |

## Execution Instructions

1. **Gather context**: Get the files to review and their contents
2. **Run Phase 1**: Execute quick-checker, show results immediately
3. **Run Phase 2**: Execute relevant specialized reviewers (can be parallel)
4. **Collect outputs**: Gather all reviewer outputs
5. **Run Phase 3**: Pass all outputs to review-coordinator
6. **Present final review**: Show the synthesized decision

## Output
The final output from review-coordinator includes:
- Clear APPROVE/REQUEST CHANGES/BLOCK decision
- Prioritized issues table (Critical → Important → Suggestions)
- Conflict resolutions with reasoning
- Specific action items for the author
