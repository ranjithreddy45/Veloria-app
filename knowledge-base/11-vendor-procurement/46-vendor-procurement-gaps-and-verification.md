# 46 - Vendor Procurement Gaps & Verification

---

## 📌 Verified Code Gaps

1. **No Standalone Event PurchaseOrder Table**: Operational procurement uses `PurchaseRequisition` status transitions (`ORDERED` -> `RECEIVED`) rather than a separate PO table.
2. **No GoodsReceipt Table**: Goods receipt is tracked by updating `PurchaseRequisitionItem.received = true` and stamping `receivedAt`.
3. **Manual Work Order Creation**: Work orders are created manually per vendor; BEO publication does not auto-generate work orders.
