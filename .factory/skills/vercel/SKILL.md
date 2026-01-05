---
name: vercel
description: Vercel deployment commands for tg-to-attio project. Use when checking deployments, logs, or environment variables.
---

# Vercel CLI Skill

Manage Vercel deployments for the tg-to-attio project.

## Project Info
- **Team/Scope**: squadsv0
- **Project**: tg-to-attio
- **Dashboard**: https://vercel.com/squadsv0/tg-to-attio

## Common Commands

### List deployments
```bash
vercel ls --scope squadsv0
```

### Check latest deployment status
```bash
vercel ls --scope squadsv0 2>&1 | head -10
```

### View deployment logs
```bash
vercel logs <deployment-url> --scope squadsv0
```

### View environment variables
```bash
vercel env ls --scope squadsv0
```

### Pull environment variables locally
```bash
vercel env pull --scope squadsv0
```

### Deploy preview
```bash
vercel --scope squadsv0
```

### Deploy to production
```bash
vercel --prod --scope squadsv0
```

### Inspect a deployment
```bash
vercel inspect <deployment-url> --scope squadsv0
```

## When to Activate
- User asks about deployment status
- User mentions "vercel", "deploy", "deployment"
- User wants to check production logs
- User needs environment variables
