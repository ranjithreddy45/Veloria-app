# 14 Vendor Advance Accounting

## Overview

When a vendor requires an upfront deposit before service delivery, an advance payout is executed (`src/actions/payout.actions.ts`).

---

## Accounting Lifecycle

### Phase 1: Advance Payout

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Vendor Advances** | `1300` | `ASSET` | **Advance Amount** | - |
| **Main Bank Account** | `1010` | `ASSET` | - | **Advance Amount** |

---

### Phase 2: Netting Against Final Vendor Bill

Upon approval of the final Vendor Bill, the advance asset is liquidated against the vendor liability:

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Vendor Payables** | `2100` | `LIABILITY` | **Advance Amount** | - |
| **Vendor Advances** | `1300` | `ASSET` | - | **Advance Amount** |
