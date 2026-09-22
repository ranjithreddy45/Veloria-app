# 20 Accounts Payable (AP) Subsystem

## Overview

The Accounts Payable module manages liabilities owed to vendors for procurement orders and approved vendor bills (`2010` and `2100`).

---

## Key Workflow & Settlement

```
[ Purchase Order / Bill Approved ]
               │
               ▼
[ AP Accrual Posted (Cr 2010 / 2100) ]
               │
               ▼
[ Payout Created & Executed (payout.actions.ts) ]
               │
               ▼
[ AP Settlement Posted (Dr 2010 / 2100, Cr Bank 1010) ]
```
