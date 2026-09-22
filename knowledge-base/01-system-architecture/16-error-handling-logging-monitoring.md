# CHUNK 01-16 — ERROR HANDLING, LOGGING & MONITORING ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/16-error-handling-logging-monitoring.md`

---

## 📌 Exception & Error Handling Architecture

Veloria Grand enforces a unified, typed error handling policy across all layers:

1. **Server Action Errors**: Handled via `try/catch` blocks returning standardized response objects:
   ```typescript
   type Result<T> = { success: true; data: T } | { success: false; error: string };
   ```
2. **Zod Input Validation Errors**: Sanitized via `safeParse()`. Validation errors flatten into field-level error messages returned to form UI.
3. **Sentry Monitoring**: Integrated at Edge, Server, and Client runtimes (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`). Automatically captures unhandled exceptions, network timeouts, and slow query transactions.
4. **Audit Logging**: Important administrative and domain state changes create audit records in `ActivityLog` and `ApprovalLog` Prisma models.
