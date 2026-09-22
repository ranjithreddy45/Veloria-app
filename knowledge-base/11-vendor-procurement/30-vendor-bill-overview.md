# 30 - Vendor Bill Overview

---

## 🧾 Vendor Bill Model (`prisma.vendorBill`)

A `VendorBill` records an Accounts Payable obligation owed to a vendor:

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique bill ID |
| `billNumber` | `String` | `@unique` | Format: `VB-YYMM-####` |
| `vendorId` | `String` | Required | Target vendor master |
| `bookingId` | `String?` | Optional | Target event booking |
| `bookingVendorId` | `String?` | Optional | Agreed rate line ID |
| `amount` | `Decimal` | `@db.Decimal(12, 2)` | Invoice amount owed |
| `expenseCode` | `String` | `@default("5230")` | P&L expense account code |
| `status` | `String` | `@default("DRAFT")` | `DRAFT`, `APPROVED`, `CANCELLED` |
| `accrualJournalEntryId` | `String?` | Optional | Linked GL accrual entry ID |
| `nettedAdvanceAmount` | `Decimal` | `@default(0)` | Advance amount netted |
