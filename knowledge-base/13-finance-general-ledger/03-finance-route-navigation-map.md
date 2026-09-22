# 03 Finance Route & Navigation Map

## Dashboard Page Routes

| Route | File Path | Access Tier / Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `/finance` | `src/app/(dashboard)/finance/page.tsx` | Staff / Finance Admin | Finance Cockpit Dashboard |
| `/finance/command-center` | `src/app/(dashboard)/finance/command-center/page.tsx` | Executive / Finance Head | Real-time Cash Position & KPIs |
| `/finance/revenue` | `src/app/(dashboard)/finance/revenue/page.tsx` | Finance Staff | Revenue Ledger & Recognition |
| `/finance/cash-flow` | `src/app/(dashboard)/finance/cash-flow/page.tsx` | Finance Staff | Operating Cash Flow View |
| `/finance/bank` | `src/app/(dashboard)/finance/bank/page.tsx` | Finance / Cashier | Bank Accounts & Reconciliation |
| `/finance/tax` | `src/app/(dashboard)/finance/tax/page.tsx` | Tax Manager | GST Filing & Tax Registers |
| `/finance/payroll` | `src/app/(dashboard)/finance/payroll/page.tsx` | HR / Payroll Accountant | Payroll GL Postings & Summaries |
| `/finance/reimbursements`| `src/app/(dashboard)/finance/reimbursements/page.tsx` | Finance Admin | Employee Reimbursement Payouts |
| `/finance/assets` | `src/app/(dashboard)/finance/assets/page.tsx` | Fixed Asset Accountant | Asset Register & Depreciation |
| `/finance/budgets` | `src/app/(dashboard)/finance/budgets/page.tsx` | Financial Planner | Budget vs Actuals |
| `/finance/anomalies` | `src/app/(dashboard)/finance/anomalies/page.tsx` | Auditor / Controller | System Anomaly Alerts |
| `/finance/e-invoice` | `src/app/(dashboard)/finance/e-invoice/page.tsx` | Billing Specialist | E-Invoicing & IRN Management |
| `/finance/reports` | `src/app/(dashboard)/finance/reports/page.tsx` | Controller / Executive | General Financial Reporting |
| `/finance/reports/event-profitability` | `src/app/(dashboard)/finance/reports/event-profitability/page.tsx` | Finance / Event Manager | Per-Event Margin Analysis |
| `/finance/reports/tally` | `src/app/(dashboard)/finance/reports/tally/page.tsx` | Accountant | Tally XML Export Portal |

---

## Invoices & Payout Routes

| Route | File Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `/invoices` | `src/app/(dashboard)/invoices/page.tsx` | Sales / Billing | Accounts Receivable Invoice Directory |
| `/invoices/new` | `src/app/(dashboard)/invoices/new/page.tsx` | Billing Specialist | Manual Invoice Creation |
| `/invoices/[invoiceId]` | `src/app/(dashboard)/invoices/[invoiceId]/page.tsx` | Billing Specialist | Invoice Detail & Status View |
| `/invoices/[invoiceId]/edit` | `src/app/(dashboard)/invoices/[invoiceId]/edit/page.tsx` | Billing Specialist | Invoice Modification Form |
| `/payments` | `src/app/(dashboard)/payments/page.tsx` | Accounts Cashier | Payment Receipt Directory |
| `/payouts` | `src/app/(dashboard)/payouts/page.tsx` | Accounts Payable | Vendor Payout Directory |
| `/payouts/bills` | `src/app/(dashboard)/payouts/bills/page.tsx` | Accounts Payable | Vendor Bills Accrual Queue |
| `/payouts/new` | `src/app/(dashboard)/payouts/new/page.tsx` | Accounts Payable | Manual Payout Creation Form |
| `/payouts/[payoutId]` | `src/app/(dashboard)/payouts/[payoutId]/page.tsx` | Accounts Payable | Payout Status & Detail |

---

## API Routes & Webhooks

| Endpoint | File Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/payments/create-order` | `src/app/api/payments/create-order/route.ts` | Authenticated | Razorpay Order Initialization |
| `/api/payments/verify` | `src/app/api/payments/verify/route.ts` | Authenticated | Razorpay Signature Verification |
| `/api/payments/webhook` | `src/app/api/payments/webhook/route.ts` | Razorpay Signature | Automated Webhook Payment Ingestion |
| `/api/cron/referral-payouts` | `src/app/api/cron/referral-payouts/route.ts` | Cron Secret | Automated Referral Payout Processing |
| `/api/finance/investor-pack` | `src/app/api/finance/investor-pack/route.ts` | Admin / Secret | Financial Reporting Export Package |
