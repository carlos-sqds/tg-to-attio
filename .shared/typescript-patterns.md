# TypeScript/NextJS Patterns

> **Agent-Ready**: See @.shared/agent-ready-code.md for core principles.

## Type Safety
- `strict: true` in tsconfig
- No `any` - use `unknown` and narrow
- Explicit return types on public functions

## React/NextJS
- App Router, Server Components by default
- `"use client"` only when needed
- Functional components, custom hooks for reuse

## Testing
- Vitest + React Testing Library for units
- Playwright for E2E
- Files: `*.test.ts` or `*.spec.ts`

## State
- Server: React Query / SWR
- Client: Zustand or Context
- Forms: React Hook Form
