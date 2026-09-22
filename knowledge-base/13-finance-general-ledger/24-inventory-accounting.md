# 24 Inventory Accounting Integration

## Code Discovery & Findings

1. **Procurement Receipt**: Receiving goods creates a GL entry (`Dr 5230 Supplies Expense / Cr 2010 Accounts Payable`).
2. **Stock Consumption**: Stock deduction in kitchen/inventory modules does **NOT** trigger automatic GL postings (`NOT IMPLEMENTED`).
3. **Manual Adjustments**: Inventory valuation adjustments must be posted manually via General Journal entries.
