# 42 - Complete BEO & Operations Feature Index

---

## 🗂️ Verified Feature Catalog

| ID | Feature Name | Route / Path | Action / API | Model | Roles | Status | Dependency Type | Source Evidence |
|---|---|---|---|---|---|---|---|---|
| **OPS-BEO-001** | Create BEO Sheet | `/beo` | `createBeo` | `Beo` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/beo.actions.ts` |
| **OPS-BEO-002** | Edit BEO Specs | `/beo/[id]` | `updateBeo` | `Beo` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/beo.actions.ts` |
| **OPS-BEO-003** | Publish BEO | `/beo/[id]` | `setBeoStatus` | `Beo` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/beo.actions.ts` |
| **OPS-BEO-004** | Lock BEO | `/beo/[id]` | `setBeoStatus` | `Beo` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/beo.actions.ts` |
| **OPS-BEO-005** | Set Headcount Source | `/beo/[id]` | `updateBeo` | `Beo` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/lib/guests/headcount.ts` |
| **OPS-BEO-006** | Log BEO Incident | `/beo/[id]` | `addBeoIncident` | `BeoIncident` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/beo.actions.ts` |
| **OPS-BEO-007** | Report Emergency Incident | `/bookings/[id]/control` | `reportIncident` | `EmergencyIncident` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/emergency.actions.ts` |
| **OPS-BEO-008** | Ops Readiness Check | `/bookings/[id]/operations` | `getOperationReadinessForBooking` | `EventOperation` | Admin, Ops | `IMPLEMENTED` | `CONDITIONAL` | `src/lib/ops/state-machine.ts` |
| **OPS-BEO-009** | Event Control Dashboard | `/bookings/[id]/control` | `getOperationReadinessForBooking` | `EventOperation` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/app/(dashboard)/bookings/[bookingId]/control` |
| **OPS-BEO-010** | Day-Of Run-of-Show Board | `/bookings/[id]/day-of` | `getTimeline`, `updateItemStatus` | `EventDayTimeline` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/app/(dashboard)/bookings/[bookingId]/day-of` |
| **OPS-BEO-011** | Kitchen Prep Plan | `/kitchen/[id]` | `createKitchenPlan`, `addPlanItem` | `KitchenPlan` | Chef, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/kitchen.actions.ts` |
| **OPS-BEO-012** | Vendor Work Order | `/vendors` | `createWorkOrder`, `sendWorkOrder` | `WorkOrder` | Admin, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/work-order.actions.ts` |
| **OPS-BEO-013** | Vendor Sign Work Order | `/vendor-portal/events` | `signWorkOrder` | `WorkOrder` | Vendor | `IMPLEMENTED` | `MANUAL` | `src/actions/work-order.actions.ts` |
| **OPS-BEO-014** | Readiness Watchdog Cron | `/api/cron/readiness-watchdog` | `readiness-watchdog/route.ts` | `EventOperation` | System / Cron | `IMPLEMENTED` | `AUTOMATIC` | `src/lib/ops/readiness-watchdog.ts` |
