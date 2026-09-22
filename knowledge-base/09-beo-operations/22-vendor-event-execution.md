# 22 - Vendor Event Execution & Work Orders

---

## 🤝 Vendor Execution Workflow (`WorkOrder` & `VendorBid`)

```mermaid
graph TD
    BEO[BEO Function Sheet] -->|Generate Work Order| WO[WorkOrder Record]
    WO -->|Dispatch Link| VP[Vendor Portal / Public Confirm]
    VP -->|Acknowledge & Sign| Sign[signWorkOrder Action]
    Sign -->|Assign On-Site Schedule| Assign[OperationVendorAssignment]
    Assign -->|Track Setup & Teardown| Execution[Setup & Teardown Timestamps]
```

- **Server Actions**: `src/actions/work-order.actions.ts` (`createWorkOrder`, `sendWorkOrder`, `signWorkOrder`).
- **Timing Trackers**: `OperationVendorAssignment` logs `arrivalTime`, `setupTime`, and `teardownTime` for on-site vendor compliance.
