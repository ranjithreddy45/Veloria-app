# 16 - Operational Readiness System

---

## 🎯 Operational Readiness Engine (`src/lib/ops/state-machine.ts`)

Veloria Grand computes a 7-gate operational readiness evaluation via `computeOperationReadiness(operationId)`:

### Mandatory Gates (Must be true for `canGoLive === true`)
1. **`beo` (Function Sheet Published)**: `Beo` exists and `status` is in `['PUBLISHED', 'LOCKED']`.
2. **`tasks` (Mandatory Tasks Complete)**: `ExecutionTask.count({ where: { isMandatory: true, status: { not: 'COMPLETED' }, phase: { plan: { operationId } } } }) === 0`.
3. **`vendors` (Vendors Confirmed)**: All `OperationVendorAssignment` associated with the operation have `status === 'CONFIRMED'`.

### Optional Gates (Affect `readyPct` score)
4. **`kitchen` (Kitchen Plan Finalised)**: `KitchenPlan` is absent or `status === 'COMPLETED'`.
5. **`procurement` (Procurement Received)**: All `PurchaseRequisition` items have `status` in `['RECEIVED', 'REJECTED']`.
6. **`logistics` (Dispatches Settled)**: All `DispatchOrder` items have `status` in `['DELIVERED', 'RETURNED', 'CANCELLED']`.
7. **`staff` (Staff Confirmed)**: All `StaffAssignment` records have `status` in `['CONFIRMED', 'CHECKED_IN']`.

---

## 🐕 Readiness Watchdog Cron vs Read Helper

- **Read Helper (`getOperationReadinessForBooking`)**: Thin read wrapper in `src/actions/ops-readiness.actions.ts` called on-demand by UI pages (`/operations`, `/control`).
- **Readiness Watchdog Cron (`/api/cron/readiness-watchdog`)**: Daily background sweep (`src/lib/ops/readiness-watchdog.ts`). Scans events occurring within 3 days (`HORIZON_DAYS = 3`). If mandatory/optional gates have open issues, it dispatches an advisory escalation alert to Ops Heads via `notifyAwait()`. It ONLY WARNS and does NOT mutate database status.
