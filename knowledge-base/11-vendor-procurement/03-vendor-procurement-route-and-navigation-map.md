# 03 - Vendor & Procurement Route & Navigation Map

---

## 🗺️ Staff Dashboard Routes

| Route | File Path | Access Permission | Purpose |
|---|---|---|---|
| `/(dashboard)/vendors` | `src/app/(dashboard)/vendors/page.tsx` | `vendors:read` | Vendor directory and category admin |
| `/(dashboard)/vendors/new` | `src/app/(dashboard)/vendors/new/page.tsx` | `vendors:create` | Add new vendor master record |
| `/(dashboard)/vendors/[vendorId]` | `src/app/(dashboard)/vendors/[vendorId]/page.tsx` | `vendors:read` | Single vendor profile, bids, and packages |
| `/(dashboard)/procurement` | `src/app/(dashboard)/procurement/page.tsx` | `procurement:read` | Purchase Requisition list and status board |
| `/(dashboard)/procurement/[id]` | `src/app/(dashboard)/procurement/[id]/page.tsx` | `procurement:read` | Purchase Requisition detail and receiving |
| `/(dashboard)/payouts/bills` | `src/app/(dashboard)/payouts/bills/page.tsx` | `payouts:read` | Vendor bill ledger and approval board |

---

## 🌐 Vendor Portal & Public Routes

| Route | File Path | Role / Auth | Purpose |
|---|---|---|---|
| `/(vendor-portal)/vendor-portal` | `src/app/(vendor-portal)/vendor-portal/page.tsx` | `role: VENDOR` | Vendor self-service dashboard |
| `/(vendor-portal)/vendor-portal/events` | `src/app/(vendor-portal)/vendor-portal/events/page.tsx` | `role: VENDOR` | Assigned events & operation confirmation |
| `/(vendor-portal)/vendor-portal/bids` | `src/app/(vendor-portal)/vendor-portal/bids/page.tsx` | `role: VENDOR` | Marketplace bid management |
| `/(vendor-portal)/vendor-portal/payouts` | `src/app/(vendor-portal)/vendor-portal/payouts/page.tsx` | `role: VENDOR` | Payout history and unpaid bills |
| `/(public)/vendor-activate` | `src/app/(public)/vendor-activate/page.tsx` | Public Token | Account activation & password setup |
| `/(public)/vendor-confirm/[token]` | `src/app/(public)/vendor-confirm/[token]/page.tsx` | Public Token | Tokenized assignment confirm/decline |
