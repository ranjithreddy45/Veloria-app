# 09 Payroll Period & Financial Year Boundary

## Period Structure

- `fy`: Indian Financial Year string (e.g. `2026-27`).
- `month`: Calendar month index (1..12).
- Enforces single payroll run per entity/period via `@@unique([entityId, fy, month])`.
