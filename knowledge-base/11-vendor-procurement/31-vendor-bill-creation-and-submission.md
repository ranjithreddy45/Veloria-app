# 31 - Vendor Bill Creation & Submission

---

## ✍️ Bill Creation (`createVendorBill`)

- **Server Action**: `createVendorBill(input)` in `src/actions/vendor-bill.actions.ts`.
- **Agreed Line Guard**: Can be derived from a `BookingVendor` agreed rate line. Guards against duplicate billing (`where: { bookingVendorId, status: { not: "CANCELLED" } }`).
- **Expense Codes**: Categorized by P&L expense accounts: `5010` (Catering), `5020` (Decor), `5030` (Staffing), `5040` (AV), `5230` (Procurement).
