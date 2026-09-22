# 03 - BEO & Operations Route Census & Map

---

## 🗺️ Operations Route Table

| Route | Type | Role Access | Purpose | Main Components | Server Actions / API |
|---|---|---|---|---|---|
| `/(dashboard)/beo` | Internal Page | Admin, Ops | Master list of all BEO function sheets with status filters (`DRAFT`, `PUBLISHED`, `LOCKED`) | `BeoListView`, `BeoFilterBar` | `getBeos` |
| `/(dashboard)/beo/[id]` | Internal Page | Admin, Ops, Chef | Detailed BEO editor, run-of-show builder, and incident logger | `BeoEditor`, `RunOfShowSection`, `BeoIncidentLogger` | `getBeo`, `updateBeo`, `setBeoStatus`, `addBeoIncident` |
| `/(dashboard)/bookings/[bookingId]/operations` | Internal Page | Admin, Ops | Operational readiness breakdown (7 gates: BEO, tasks, vendors, kitchen, procurement, logistics, staff) | `OpsReadinessCard`, `GateChecklist` | `getOperationReadinessForBooking` |
| `/(dashboard)/bookings/[bookingId]/control` | Internal Page | Admin, Ops | Event Control Dashboard: live operation readiness, emergency protocols, incident logger | `EventControlDashboard`, `EmergencyLogger` | `getOperationReadinessForBooking`, `reportIncident` |
| `/(dashboard)/bookings/[bookingId]/day-of` | Internal Page | Ops | Day-Of Run-of-Show timeline execution & staff task execution board | `DayOfRunOfShow`, `StaffAssignmentBoard` | `getTimeline`, `updateItemStatus` |
| `/(dashboard)/bookings/[bookingId]/execution` | Internal Page | Ops | Event execution plan phases, SLA tasks, and vendor bid reviews | `ExecutionPlanView`, `SlaTaskTable` | `getExecutionPlan`, `addExecutionTask` |
| `/(dashboard)/kitchen` | Internal Page | Chef, Ops | Kitchen prep master list across active event dates | `KitchenPlanListView` | `getKitchenPlans` |
| `/(dashboard)/kitchen/[id]` | Internal Page | Chef | Kitchen batch prep plan editor, ingredient quantities, and cost tracker | `KitchenPlanEditor`, `IngredientTable` | `getKitchenPlan`, `updateKitchenPlan`, `addPlanItem` |
| `/(dashboard)/tasks` | Internal Page | Admin, Ops, Staff | Operational SLA task master board across all properties | `TaskMasterBoard` | `addExecutionTask`, `startTask`, `completeTask` |
| `/(dashboard)/vendors` | Internal Page | Admin, Ops | Vendor directory, categories, ratings, and active assignments | `VendorListView` | `getWorkOrders`, `confirmVendorAssignment` |
| `/(vendor-portal)/vendor-portal/events` | Vendor Portal | Vendor | Vendor portal event work orders, on-site setup times, and acknowledgment | `VendorEventList` | `acknowledgeWorkOrder`, `signWorkOrder` |
| `/api/cron/readiness-watchdog` | API Route | System / Cron | Automated sweep sending alerts for un-ready events happening within 3 days (72h horizon) | N/A | `readiness-watchdog/route.ts` |
| `/api/cron/vendor-reminders` | API Route | System / Cron | Automated reminder dispatch for pending vendor work order signatures | N/A | `vendor-reminders/route.ts` |
