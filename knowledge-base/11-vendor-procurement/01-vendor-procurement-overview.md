# 01 - Vendor & Procurement Overview

---

## 🏛️ Module Architecture

The Vendor & Procurement module in Veloria Grand encompasses two primary functional pillars:
1. **Vendor Management & Operations**: Vendor master records, catalog packages, event assignments, work orders with e-signatures, and vendor portal self-service.
2. **Procurement & Inventory Receiving**: Purchase requisitions, multi-tier approval workflows, goods receiving, and automated General Ledger expense accruals.

```
+-----------------------------------------------------------------------------------+
|                                 VENDOR OPERATIONS                                 |
+-----------------------------------------------------------------------------------+
|  Vendor Master  --->  Booking Assignment  --->  Work Order (WO-YYYY-NNN)           |
|  (Vendor)             (BookingVendor)          (Draft -> Sent -> Signed)          |
|                             |                              |                      |
|                             v                              v                      |
|                     Vendor Portal                 Vendor Bill (VB-YYMM-####)       |
|                     (Accept/Decline)              (Draft -> Approved -> GL)        |
+-----------------------------------------------------------------------------------+

+-----------------------------------------------------------------------------------+
|                            PROCUREMENT & INVENTORY                                |
+-----------------------------------------------------------------------------------+
|  Purchase Requisition --->  Approval  --->  Ordered  --->  Received                |
|  (PR-YYYY-NNN)              (Maker-         (markOrdered)  (markReceived)         |
|                             Checker)                              |               |
|                                                                   v               |
|                                                            GL Accrual (5230/2010) |
+-----------------------------------------------------------------------------------+
```

---

## 🔑 Core Domain Components

| Domain Component | Primary Model / Action | Core Purpose | Status |
|---|---|---|---|
| **Vendor Master** | `Vendor` | Marketplace directory of event service vendors and suppliers | `CODE VERIFIED` |
| **Vendor Portal** | `User (role: VENDOR)` | Isolated portal for vendors to view events, submit bids, accept assignments | `CODE VERIFIED` |
| **Work Orders** | `WorkOrder` | Legally binding event work contracts with e-signature and advance tracking | `CODE VERIFIED` |
| **Purchase Requisitions** | `PurchaseRequisition` | Event and kitchen supply purchasing with maker-checker approvals | `CODE VERIFIED` |
| **Vendor Bills** | `VendorBill` | Accounts payable invoice records linked to GL accruals | `CODE VERIFIED` |
| **GL Bridge** | `postPurchaseReceivedWithinTx` | Automated double-entry bookkeeping on goods receipt and bill approval | `CODE VERIFIED` |
