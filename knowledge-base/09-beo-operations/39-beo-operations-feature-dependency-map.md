# 39 - BEO & Operations Feature Dependency Map

---

## 🔄 Explicit Dependency Classification Graph

```mermaid
graph TD
    Booking[Booking] -->|MANUAL: createBeo| BEO[Beo Record]
    Booking -.->|CONDITIONAL: provisionEventOps| EventOp[EventOperation]
    BEO -.->|MANUAL: createKitchenPlan| Kitchen[KitchenPlan]
    BEO -.->|MANUAL: createWorkOrder| WorkOrder[WorkOrder]
    EventOp -.->|MANUAL: createTimeline| Timeline[EventDayTimeline]
    EventOp -.->|MANUAL: addExecutionTask| Tasks[ExecutionTasks]
    WorkOrder -.->|MANUAL: createVendorBill| VendorBill[VendorBill]
    VendorBill -->|AUTOMATIC: accrual entry| GL[GeneralLedger]
```

- **AUTOMATIC**: `VendorBill -> GeneralLedger` (Accrual entry generated upon bill approval).
- **MANUAL**: `Booking -> Beo`, `Beo -> KitchenPlan`, `Beo -> WorkOrder`, `EventOp -> Timeline`, `EventOp -> Tasks`, `WorkOrder -> VendorBill`.
- **CONDITIONAL**: `Booking -> EventOperation`.
