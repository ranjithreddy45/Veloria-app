# 26 - Purchase Order Analysis

---

## 🔍 Codebase Architecture Finding: `PurchaseOrder` Model Analysis

- **Operational Event Procurement**: Does **NOT** use a separate `PurchaseOrder` or `GoodsReceipt` database table. The lifecycle transitions directly within `PurchaseRequisition`: `PENDING` -> `APPROVED` -> `ORDERED` -> `RECEIVED`.
- **Capex BD Projects**: A separate `ProjectPurchaseOrder` model exists solely under Property Acquisition & BD projects (`AcqOnboardingProject`). It does NOT handle event catering or venue inventory procurement.
