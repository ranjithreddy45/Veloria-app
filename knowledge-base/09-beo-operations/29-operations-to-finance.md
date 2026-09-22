# 29 - Operations to Finance Handoff

---

## 💸 Operational Cost & Financial Settlement

- **ExecutionTask -> VendorBill**: **NOT DIRECTLY CONNECTED**. Completing an execution task does NOT automatically create a vendor bill.
- **VendorBill Creation**: **MANUAL**. Vendor bills are created manually or submitted by vendors via `src/actions/vendor-bill.actions.ts` referencing `bookingVendorId` or `workOrderId`.
- **VendorBill -> GeneralLedger**: **AUTOMATIC**. Approving a `VendorBill` automatically generates an accrual journal entry (`accrualJournalEntryId`) in the General Ledger.
