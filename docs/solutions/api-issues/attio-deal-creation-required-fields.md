---
title: Attio Deal Creation - Required Fields and Currency Format
category: api-issues
tags: [attio, api, deals, currency, e2e-testing]
created: 2025-01-05
symptoms: "400 error with missing_value or validation_type when creating deals"
---

# Attio Deal Creation - Required Fields and Currency Format

## Problem
Creating deals via Attio API fails with validation errors, even when providing name and value.

## Symptoms
- `400` error: `missing_value` for attribute ID
- `400` error: `validation_type` with `Unrecognized key(s) in object: 'value', 'currency'`
- Deal creation works in UI but fails via API

## Root Cause
Two issues:

1. **Workspace-specific required fields**: Attio workspaces can have custom required fields on deals. Common required fields:
   - `name` (text) - always required
   - `stage` (status) - often required, must match a configured stage
   - `owner` (actor-reference) - often required, must be workspace member email

2. **Wrong currency format**: Currency values must be written as **plain numbers**, not objects. The currency code is configured at the attribute level, not per-record.

## Solution

### 1. Discover Required Fields
```bash
# List all deal attributes and their requirements
curl -H "Authorization: Bearer $ATTIO_API_KEY" \
  "https://api.attio.com/v2/objects/deals/attributes" | jq '.data[] | {slug: .api_slug, type: .type, required: .is_required}'
```

### 2. Get Valid Stage Options
```bash
curl -H "Authorization: Bearer $ATTIO_API_KEY" \
  "https://api.attio.com/v2/objects/deals/attributes/stage/statuses" | jq '.data[] | {title, is_archived}'
```

### 3. Get Workspace Members (for owner)
```bash
curl -H "Authorization: Bearer $ATTIO_API_KEY" \
  "https://api.attio.com/v2/workspace_members" | jq '.data[] | {email: .email_address, name: "\(.first_name) \(.last_name)"}'
```

### 4. Correct API Call
```typescript
// WRONG - currency as object
const dealData = {
  data: {
    values: {
      name: "Deal Name",
      value: { value: 50000, currency: "USD" },  // WRONG!
    }
  }
};

// CORRECT - currency as plain number + required fields
const dealData = {
  data: {
    values: {
      name: "Deal Name",
      stage: "Lead",                    // Required - use valid stage title
      owner: "user@company.com",        // Required - workspace member email
      value: 50000,                     // Plain number
      associated_company: {
        target_object: "companies",
        target_record_id: companyId,
      }
    }
  }
};
```

## Code Example

Dynamic fetching for E2E tests (workspace-portable):

```typescript
async function fetchWorkspaceDefaults() {
  // Get first available stage
  const stagesRes = await fetch(
    `${ATTIO_BASE_URL}/objects/deals/attributes/stage/statuses`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const stages = await stagesRes.json();
  const stage = stages.data.find((s) => !s.is_archived)?.title;

  // Get first workspace member
  const membersRes = await fetch(
    `${ATTIO_BASE_URL}/workspace_members`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const members = await membersRes.json();
  const ownerEmail = members.data[0]?.email_address;

  return { dealStage: stage, ownerEmail };
}
```

## Prevention

1. **Check workspace schema first**: Before implementing record creation, fetch `/objects/{object}/attributes` to discover required fields
2. **Use plain numbers for currency**: Never wrap in `{ value, currency }` - currency is attribute-level config
3. **E2E tests should be dynamic**: Fetch workspace defaults rather than hardcoding values that may differ across workspaces

## Related
- [Attio API Docs - Create Deal](https://docs.attio.com/rest-api/endpoint-reference/deals/create-a-deal-record)
- [Attio API Docs - Currency Attributes](https://docs.attio.com/docs/attribute-types/attribute-types-currency)
