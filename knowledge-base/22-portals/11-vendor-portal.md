# 11 Vendor Portal Overview & Dashboard (`/vendor-portal/*`)

`CODE VERIFIED`

## Vendor Portal Architecture

The Vendor Portal (`/vendor-portal`) allows external service providers (Caterers, Decorators, AV Specialists, Florists, Photographers) to view work orders, submit bids, track event assignments, and monitor payout status.

```
+-----------------------------------------------------------------------------------+
|                            VENDOR PORTAL DASHBOARD                                |
|                        (src/actions/vendor.actions.ts)                            |
+-----------------------------------------------------------------------------------+
       |                                      |                                   |
       v                                      v                                   v
+-----------------------+          +-----------------------+          +-----------------------+
|    ASSIGNED EVENTS    |          |   BID MANAGEMENT      |          |  PAYOUTS & BILLING    |
| /vendor-portal/events |          | /vendor-portal/bids   |          | /vendor-portal/payouts|
+-----------------------+          +-----------------------+          +-----------------------+
```

### Scoping Enforcement
All vendor actions require `session.user.role == 'VENDOR'`. Queries filter strictly by `vendorId: session.user.vendorId`.
