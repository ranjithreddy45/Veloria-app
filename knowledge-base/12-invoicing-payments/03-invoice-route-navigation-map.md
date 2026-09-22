# 03 - Invoice & Payment Route Map

---

## 🗺️ Staff Dashboard Routes

| Route | File Path | Permission | Purpose |
|---|---|---|---|
| `/(dashboard)/invoices` | `src/app/(dashboard)/invoices/page.tsx` | `invoices:read` | Invoice ledger and status summary |
| `/(dashboard)/invoices/new` | `src/app/(dashboard)/invoices/new/page.tsx` | `invoices:create` | Create new manual invoice |
| `/(dashboard)/payments` | `src/app/(dashboard)/payments/page.tsx` | `payments:read` | Recorded payments & proof verification |
| `/(dashboard)/payouts` | `src/app/(dashboard)/payouts/page.tsx` | `payouts:read` | Vendor and referral payout board |

---

## 🌐 Public & Portal Payment Routes

| Route | File Path | Auth / Access | Purpose |
|---|---|---|---|
| `/(portal)/portal/invoices` | `src/app/(portal)/portal/invoices/page.tsx` | Client Portal | Client view of event invoices |
| `/(portal)/portal/invoices/[id]` | `src/app/(portal)/portal/invoices/[id]/page.tsx` | Client Portal | Detailed invoice view & Razorpay checkout |
| `/(print)/invoices/[id]/pdf` | `src/app/(print)/invoices/[id]/pdf/page.tsx` | Staff / Client | Printable HTML tax invoice template |
| `/pay/[token]` | `src/app/pay/[token]/page.tsx` | Public Token | Public one-click payment checkout |
| `/pay/split/[token]` | `src/app/pay/split/[token]/page.tsx` | Public Token | Multi-payer split payment link |
