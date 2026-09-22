# 01 Finance & General Ledger Overview

## Executive Summary

The **Finance & General Ledger (GL) Subsystem** in Veloria Grand serves as the single financial source of truth for the entire enterprise banquet and venue management platform. It standardizes double-entry bookkeeping, maintains an immutable journal ledger, manages multi-tier Chart of Accounts (COA), automates revenue recognition, handles vendor bill accruals, processes payroll GL postings, enforces period-closing controls, and formats statutory GST and Tally XML exports.

---

## High-Level Architectural Flow

```
[ Business Events ]
 (Invoice Issued, Payment Captured, Vendor Bill Approved, Goods Received, Payroll Run, Reimbursement Paid)
         │
         ▼
[ Server Actions / Services ]
 (receivables.ts, payables.ts, procurement.ts, ledger.ts, finance.actions.ts, payout.actions.ts)
         │
         ▼
[ Double-Entry Journal Engine ]
 (createJournalEntryWithinTx - Validates Debits == Credits & Period Lock)
         │
         ▼
[ Database Transaction (PostgreSQL / Prisma) ]
 (FinJournalEntry + FinJournalLine + FinAccount Balance Update)
         │
         ▼
[ Financial Reporting & Integrations ]
 (Trial Balance, P&L, Balance Sheet, GST Return, Tally XML Export, E-Invoice)
```

---

## Implementation Status Summary

| Area | Status | Key Components / File Paths |
| :--- | :--- | :--- |
| **Chart of Accounts (COA)** | `CODE VERIFIED` | `src/lib/finance/coa-seed.ts`, `FinAccount` |
| **Double-Entry Journal Engine** | `CODE VERIFIED` | `src/lib/finance/ledger.ts`, `FinJournalEntry`, `FinJournalLine` |
| **Accounts Receivable (AR)** | `CODE VERIFIED` | `src/lib/finance/receivables.ts`, `src/actions/invoice.actions.ts` |
| **Accounts Payable (AP)** | `CODE VERIFIED` | `src/lib/finance/payables.ts`, `src/actions/vendor-bill.actions.ts` |
| **Procurement GL Posting** | `CODE VERIFIED` | `src/lib/finance/procurement.ts` |
| **Payroll GL Integration** | `CODE VERIFIED` | `src/actions/hr-payroll-run.actions.ts`, `src/actions/finance-payroll.actions.ts` |
| **Reimbursement GL Integration** | `CODE VERIFIED` | `src/actions/hr-reimbursement.actions.ts` |
| **GST Tax Ledger (CGST/SGST/IGST)** | `CODE VERIFIED` | `src/lib/finance/tax.ts`, `src/actions/finance-tax.actions.ts` |
| **Tally XML Integration** | `CODE VERIFIED` | `src/lib/finance/tally-xml.ts`, `src/actions/finance-tally.actions.ts` |
| **E-Invoicing (IRN Engine)** | `PARTIALLY IMPLEMENTED` | `src/lib/finance/einvoice-adapter.ts`, `FinEInvoice` (DB ready, mock IRP adapter) |
| **Bank & Cash Reconciliation** | `CODE VERIFIED` | `src/lib/finance/gl-reconcile.ts`, `src/lib/finance/reconcile.ts` |
| **Recipe-Driven Inventory GL Posting** | `NOT IMPLEMENTED` | Stock movements do not write automatic GL entries |

---

## Core Document Navigation
- [04 Chart of Accounts](file:///Users/fci/Documents/Veloria-app/knowledge-base/13-finance-general-ledger/04-chart-of-accounts.md)
- [07 Journal Entry Engine](file:///Users/fci/Documents/Veloria-app/knowledge-base/13-finance-general-ledger/07-journal-entry-engine.md)
- [10 Invoice to GL](file:///Users/fci/Documents/Veloria-app/knowledge-base/13-finance-general-ledger/10-invoice-to-gl.md)
- [11 Payment to GL](file:///Users/fci/Documents/Veloria-app/knowledge-base/13-finance-general-ledger/11-payment-to-gl.md)
- [44 Finance End-to-End Journeys](file:///Users/fci/Documents/Veloria-app/knowledge-base/13-finance-general-ledger/44-finance-end-to-end-journeys.md)
