# 12 Vendor Bill to General Ledger Integration

## Accounting Treatment for Approved Vendor Bills

When a Vendor Bill is approved (`approveVendorBill` in `src/actions/vendor-bill.actions.ts`), the system recognizes the expense accrual and credits Vendor Payables (`2100`).

---

## Journal Entry Structure

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Event Expense** (e.g. F&B `5010` / Decor `5030`) | `5010`-`5080` | `EXPENSE` | **Bill Amount** | - |
| **Vendor Payables** | `2100` | `LIABILITY` | - | **Bill Amount** |

---

## Advance Netting Adjustment (If Applicable)

If a vendor advance (`1300`) was previously paid to the vendor:

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Vendor Payables** | `2100` | `LIABILITY` | **Advance Amount** | - |
| **Vendor Advances** | `1300` | `ASSET` | - | **Advance Amount** |
