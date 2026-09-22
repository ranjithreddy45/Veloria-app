# Discounts, Margin Controls & Adjustments

## Overview

Discounts can be applied as a percentage (`discountPct`) or fixed amount (`discountAmount`), subject to role-based approval thresholds.

---

## Discount Approval Thresholds

- **Standard Sales Exec Limit**: Discounts <= 10% auto-approve.
- **Sales Head Limit**: Discounts between 10.01% and 20% require `SALES_HEAD` approval.
- **Super Admin Limit**: Discounts > 20% require `ADMIN` or `SUPER_ADMIN` approval.
- **State Transition**: When discount exceeds standard threshold, `SalesQuotationStatus` is set to `PENDING_APPROVAL`.
