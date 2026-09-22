# 44 End-to-End Financial Journeys

## Journey 1: Customer Invoice to Payment

```
[ Create Invoice ] ──► [ Issue Invoice ] ──► [ GL: Dr AR 1200 / Cr Rev 4010 + Tax 2210/2220 ]
                                                      │
                                                      ▼
[ Capture Payment ] ◄── [ Receive Razorpay / Cash ] ──┘
        │
        ▼
[ GL: Dr Bank 1010 / Cr AR 1200 ]
```

---

## Journey 2: Vendor Bill to Payout

```
[ Vendor Bill Submitted ] ──► [ Approve Bill ] ──► [ GL: Dr Expense 5010 / Cr AP 2100 ]
                                                           │
                                                           ▼
[ Payout Executed ] ◄── [ Bank Transfer ] ─────────────────┘
        │
        ▼
[ GL: Dr AP 2100 / Cr Bank 1010 ]
```
