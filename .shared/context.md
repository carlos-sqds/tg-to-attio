# Attio-TG Project Context

## Stack
- **Runtime**: TypeScript, Next.js (App Router)
- **Bot Framework**: grammY (Telegram)
- **AI**: Vercel AI SDK
- **Testing**: Vitest
- **Deployment**: Vercel Serverless
- **Session Storage**: Upstash Redis

## Core Commands
| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Type check | `npm run type-check` |
| Test | `npm run test` |
| Test (run once) | `npm run test:run` |

## Git Workflow
- Branch: `feat/<slug>` or `fix/<slug>` from `main`
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Run type-check + tests before commit
- PR required for main

## Code Style
- TypeScript: Strict mode, no `any`, explicit return types
- Keep functions < 30 lines, files < 300 lines
