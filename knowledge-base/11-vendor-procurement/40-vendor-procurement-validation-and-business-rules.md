# 40 - Vendor Procurement Validation & Business Rules

---

## 📏 Core Business Rules

1. **Vendor Deduplication**: Vendor name (case-insensitive), phone, and email are strictly checked prior to insert.
2. **Account Takeover Block**: `acceptVendorInvite` rejects activation if a `User` record already exists for `vendor.email`.
3. **Maker-Checker Security**: Requester cannot approve their own PR (`requestedById !== u.id`); Creator cannot approve their own Vendor Bill (`createdById !== u.id`).
4. **Work Order State Lock**: Work order signing requires prior `ACKNOWLEDGED` status; signing locks document state.
5. **GL Accrual Integrity**: Goods receipt (`markReceived`) and Vendor Bill approval (`approveVendorBill`) post GL entries in atomic database transactions.
