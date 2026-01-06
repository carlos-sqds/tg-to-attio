---
title: Debugging Third-Party API Validation Errors
category: patterns
tags: [api, debugging, validation, integration, methodology]
created: 2026-01-06
symptoms:
  - "400 Bad Request with validation_errors"
  - "Invalid value passed to attribute"
  - "Unexpected format or structure rejected"
root_cause: API payload format doesn't match expected schema
stack: [typescript, api-integration]
severity: moderate
---

# Debugging Third-Party API Validation Errors

## The Problem

API returns 400 with validation errors like:
- "Invalid value was passed to attribute X"
- "Expected array, received string"
- "Too many/few keys in object"

## 5-Step Debugging Process

### 1. Read the Error Message Precisely

Parse every word:
- "must be an array" → wrap in `[]`
- "too many keys" → remove extra fields
- "expected X, received Y" → type mismatch

### 2. Find Working Examples in Codebase

```bash
grep -r "endpoint_name\|field_name" --include="*.ts" tests/
```

E2E tests and other integrations show proven formats.

### 3. Check Official API Docs

Look for:
- Required vs optional fields
- Exact data types (array vs object vs string)
- Valid values for enums
- Nested structure requirements

### 4. Compare Working vs Broken

```typescript
// Working (from tests/elsewhere)
{ field: [{ key: "value" }] }

// Broken (your code)  
{ field: { key: "value" } }  // Missing array wrapper
```

### 5. Test Minimal Payload

Strip to bare minimum, then add fields back:
```typescript
// Start minimal
{ required_field: "value" }

// Add one field at a time until it breaks
```

## Common Patterns

| Error Pattern | Likely Fix |
|---------------|------------|
| "must be array" | Wrap value in `[]` |
| "too many keys" | Remove extra fields from object |
| "invalid type" | Check string vs number vs object |
| "required field" | Add missing field |
| "unknown field" | Check spelling, remove field |

## Prevention

1. **Write tests that verify exact payload format**
2. **Log payloads in dev** to see what's actually sent
3. **Keep API doc links in code comments**
4. **Use TypeScript types matching API schema**

## Example: Record Reference Fix

Error: "Too many matching attributes... Expected only target_object key and one other"

Investigation:
1. Error says exactly 2 keys expected
2. Our code had 3 keys
3. Docs showed valid combinations
4. Fixed by removing invalid key

Before:
```typescript
{ target_object: "x", target_record_id: null, display_name: "y" }  // 3 keys
```

After:
```typescript
[{ target_object: "x", target_record_id: "id" }]  // 2 keys, in array
```
