# 19 Accounts Receivable (AR) Subsystem

## Overview

The Accounts Receivable module tracks outstanding client balances, invoice dues, payment allocations, and client aging.

---

## Key Calculations & Fields

- **Total Billed**: Sum of all `Invoice.totalAmount` in `ISSUED` status.
- **Total Collected**: Sum of all `Payment.amount` linked to issued invoices.
- **Outstanding AR**: Calculated dynamically as `Total Billed - Total Collected` or retrieved from `FinAccount.currentBalance` for `1200`.

---

## AR Aging Buckets

1. **Current (0 - 30 Days)**
2. **31 - 60 Days**
3. **61 - 90 Days**
4. **90+ Days Overdue**
