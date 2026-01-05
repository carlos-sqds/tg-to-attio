# Agent-Ready Code Principles

Code should be written so AI agents can easily understand, navigate, and modify it. This is a **core design principle** - prioritize agent-readiness in all code decisions.

## Core Principles

### 1. Explicit Over Implicit
- Import dependencies explicitly, not via barrel files or wildcards
- Declare types explicitly on public APIs
- Use named exports over default exports
- Avoid magic strings - use typed constants or enums

### 2. Searchable & Navigable
- Predictable naming: `UserService`, `user.service.ts`, `user_service.rs`
- Consistent file organization within each package/crate
- Colocate related code (tests next to implementation)
- Use descriptive, unique names (avoid generic `utils`, `helpers`, `common`)

### 3. Bounded Complexity
- Functions: < 30 lines, single responsibility
- Files: < 300 lines
- Nesting: < 4 levels of control flow
- Parameters: < 5 per function (use options object if more)

### 4. Static Analysis Friendly
- Strong typing everywhere (no `any`, use `unknown` and narrow)
- Avoid runtime metaprogramming (`eval`, `new Function`, reflection)
- No monkey patching or prototype modification
- Prefer composition over inheritance

### 5. Isolated & Testable
- Pure functions where possible
- Explicit dependency injection
- No hidden global state
- Side effects at the edges, logic in the center

## Monorepo Considerations

Nesting is acceptable and expected in monorepos:
```
packages/
  auth/
    src/
      handlers/
      services/
  api/
    src/
      routes/
```

**Key principle**: Consistent structure across packages. If `auth/src/handlers/` exists, `api/src/handlers/` should follow the same pattern.

## Agent-Hostile Patterns (Avoid)

| Pattern | Problem | Alternative |
|---------|---------|-------------|
| `obj[dynamicKey]` | Can't trace statically | Typed accessor functions |
| Barrel files re-exporting everything | Obscures actual source | Direct imports |
| `export default` | Harder to grep | Named exports |
| Magic event strings `"user.created"` | Not searchable as references | Typed event constants |
| Circular dependencies | Breaks analysis | Restructure or extract shared module |
| Deep inheritance hierarchies | Hard to trace behavior | Composition |
| Decorators with side effects | Hidden behavior | Explicit wiring |

## Checklist for Agent-Readiness

Before committing, verify:
- [ ] Can an agent find this code by searching for the feature name?
- [ ] Are all dependencies explicit and traceable?
- [ ] Can tests be run in isolation?
- [ ] Are types explicit on public interfaces?
- [ ] Is the file < 300 lines?
- [ ] Would a new agent understand this without reading 5 other files first?

## Examples

### Imports
```typescript
// Agent-hostile: Where does createUser come from?
import { createUser } from "@/services";

// Agent-ready: Clear source
import { createUser } from "@/services/user.service";
```

### Event Handling
```typescript
// Agent-hostile: Magic string, can't find usages
emitter.emit("user.created", user);

// Agent-ready: Typed, searchable
import { UserEvents } from "./user.events";
emitter.emit(UserEvents.CREATED, user);
```

### Configuration
```rust
// Agent-hostile: String keys, no compile-time checking
config.get("database.url")

// Agent-ready: Typed config struct
config.database.url
```

## Integration with Reviews

The `agent-ready-reviewer` droid checks for these patterns during PR reviews. The `simplicity-check` skill also considers agent-readiness when evaluating proposed solutions.
