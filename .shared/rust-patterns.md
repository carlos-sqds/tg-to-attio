# Rust/Axum Patterns

> **Agent-Ready**: See @.shared/agent-ready-code.md for core principles.

## Error Handling
- `thiserror` for library errors, `anyhow` for app errors
- Return `Result<T, AppError>` from handlers
- Use `.context()` for debugging info

## Axum Handler Pattern
```rust
async fn handler(
    State(state): State<AppState>,
    Json(payload): Json<Request>,
) -> Result<Json<Response>, AppError> {
    // implementation
}
```

## Testing
- Unit tests: `#[cfg(test)]` in same file
- Integration tests: `tests/` directory
- Use `tower::ServiceExt` for handler tests

## Key Crates
`axum`, `tokio`, `serde`, `sqlx`, `tracing`, `thiserror`
