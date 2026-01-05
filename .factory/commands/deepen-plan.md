---
name: deepen-plan
description: Enhance plans with parallel research agents for each section
argument-hint: "[plan-file-path]"
---

# /deepen-plan

Take an existing plan and enrich it with best practices, examples, and research.

## Usage
```
/deepen-plan [plan-file-or-paste-plan]
```

## Process

1. **Parse Plan**
   - Identify main sections/tasks
   - Extract technologies mentioned
   - Note areas of uncertainty

2. **Parallel Research**
   For each section, spawn `best-practices-researcher` subagent:
   - Best practices for the approach
   - Common pitfalls to avoid
   - Code examples from authoritative sources
   - Alternative approaches considered

3. **Merge Findings**
   Enhance each section with:
   - Supporting evidence
   - Code snippets
   - Risk considerations
   - Time estimates

4. **Generate Enhanced Plan**

## Output Format

```markdown
# Enhanced Plan: [Title]

## Section 1: [Name]

### Original Plan
[What was planned]

### Best Practices
- [Practice 1] - Source: [link]
- [Practice 2] - Source: [link]

### Code Examples
```[language]
[example from authoritative source]
```

### Pitfalls to Avoid
- [Pitfall 1] - [why and how to avoid]

### Time Estimate
[Refined estimate based on research]

---

## Section 2: [Name]
[Same structure]

---

## Summary
- Total estimated time: [X hours]
- Key risks: [list]
- Dependencies: [list]
```

## When to Use
- Before starting significant features
- When plan feels incomplete
- When uncertain about approach
- Before presenting to stakeholders
