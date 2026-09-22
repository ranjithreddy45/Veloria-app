# 26 RBAC Interaction & Portal Role Scoping

`CODE VERIFIED`

## Role-Based Access Control Matrix

| System Role | Portal Access Level | Route Boundaries | Allowed Actions |
| :--- | :--- | :--- | :--- |
| `CLIENT` | Client Portal Only | `/portal/*` | View own bookings, invoices, contracts, sign contracts, pay invoices, submit RSVPs |
| `VENDOR` | Vendor Portal Only | `/vendor-portal/*` | View assigned work orders, submit bids, track bills & payouts |
| `SUPER_ADMIN` / `ADMIN` | Full System Access | All Routes (`/portal`, `/vendor-portal`, `/dashboard`) | Admin override, generate invites, manage accounts |
| Anonymous Visitor | Tokenized Public Routes | `/q/*`, `/pay/*`, `/sign/*`, `/hold/*`, `/form/*` | View specific tokenized asset, sign/pay, submit leads |
