# 28 - BEO to Operations Downstream Connections

---

## 🔗 Downstream Relationship Classification

| Downstream Target | Dependency Classification | Trigger & Source Evidence |
|---|---|---|
| **EventOperation** | **CONDITIONAL** | Provisioned via `provisionEventOperations()` or read-time initialization |
| **KitchenPlan** | **MANUAL** | Mints via `createKitchenPlan(data)` in `src/actions/kitchen.actions.ts`. Publishing BEO does NOT auto-create KitchenPlan. |
| **WorkOrder** | **MANUAL** | Mints via `createWorkOrder(data)` in `src/actions/work-order.actions.ts`. Publishing BEO does NOT auto-create WorkOrders. |
| **EventDayTimeline** | **MANUAL** | Created via `createTimeline(bookingId)` in `src/actions/event-day.actions.ts`. |
| **ExecutionTask** | **MANUAL** | Added via `addExecutionTask()` in `src/actions/execution-task.actions.ts`. |
