---
title: Vercel Workflow SDK Serialization Error and Stuck Hook Tokens
category: api-issues
tags: [vercel-workflow, serialization, hooks, telegram-bot]
created: 2026-01-05
symptoms:
  - "Failed to start: {\"error\":\"Internal server error\"}"
  - "Please send /start first to begin" in infinite loop
  - Welcome message sent but workflow doesn't receive events
root_cause: Workflow SDK cannot serialize callbacks capturing workflow state; hook tokens can become stuck in Vercel's system
stack: [typescript, nextjs, vercel-workflow]
severity: critical
---

# Vercel Workflow SDK Serialization Error and Stuck Hook Tokens

## Symptoms

1. **Serialization error**: `/start` returns `Failed to start: {"error":"Internal server error"}`
2. **Stuck hooks**: Welcome message appears but forwarding messages triggers "Please send /start first to begin" repeatedly

## Root Cause

### Issue 1: Callback Serialization Failure

The Vercel Workflow SDK cannot serialize **closures that capture workflow state**. This pattern breaks:

```typescript
// BROKEN - callback captures workflow state (schema, messageQueue, etc.)
const processWithAI = async () => {
  if (!schema) { schema = await fetchFullSchemaCached(); }
  const messagesForAI = messageQueue.map((m) => ({ ... }));
  return await analyzeIntent({ messages: messagesForAI, instruction, schema });
};
currentAction = await withCyclingReaction(chatId, event.messageId, processWithAI);
```

From the Workflow SDK docs:
> "Functions cannot be serialized... pass configuration data instead"

### Issue 2: Stuck Hook Tokens

Hook tokens (e.g., `ai6-${userId}`) can become stuck in Vercel's workflow system. When this happens:
- New workflows create hooks with the same token
- `resume()` calls fail because the token is associated with a dead workflow
- Symptoms appear as "workflow not found" even though `/start` succeeded

## Solution

### Fix 1: Remove Callback Pattern

Replace callbacks with inline code + simple reactions:

```typescript
// FIXED - inline code, no callback
if (event.messageId) {
  await setMessageReaction(chatId, event.messageId, "🤔"); // Start
}

// Inline processing (no closure capture)
if (!schema) { schema = await fetchFullSchemaCached(); }
const messagesForAI = messageQueue.map((m) => ({ ... }));
currentAction = await analyzeIntent({ messages: messagesForAI, instruction, schema: schema! });

if (event.messageId) {
  await setMessageReaction(chatId, event.messageId, null); // Clear
}
```

### Fix 2: Upgrade Hook Token Prefix

Change the token prefix to bypass stuck tokens:

```typescript
// Before (stuck)
const events = telegramHook.create({ token: `ai6-${userId}` });

// After (fresh)
const events = telegramHook.create({ token: `ai7-${userId}` });
```

Update all locations:
- `workflows/conversation-ai.ts` - hook creation
- `app/api/webhook/route.ts` - `tryResumeWorkflow()` and `/start` handler
- `tests/webhook/webhook.test.ts` - test expectations

## Files Changed

- `workflows/conversation-ai.ts` - inline reactions, new token prefix
- `workflows/steps/telegram.ts` - `setMessageReaction` step function
- `app/api/webhook/route.ts` - new token prefix, better error logging

## Prevention

1. **Never use callbacks inside workflows** that capture workflow state
2. **Document token prefix** in code comments for future reference
3. **Better error messages** - show actual error in Telegram for faster debugging:
   ```typescript
   await sendTelegramMessage(chatId, `Failed to start: ${errorMsg.substring(0, 100)}`);
   ```

## Git History

This repo has upgraded tokens multiple times:
- `ai4` → `ai5` → `ai6` → `ai7`

Each upgrade was needed to bypass stuck hooks from previous iterations.

## Related

- [Vercel Workflow SDK Best Practices](https://gist.github.com/johnlindquist/8d8ae46d3bbc12005a364b25d3f1c7e9)
- Workflow SDK serialization docs: Functions cannot be serialized
