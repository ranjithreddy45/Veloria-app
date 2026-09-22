# 10 - Vendor Portal Overview

---

## 🚪 Portal Architecture

The Vendor Portal is an isolated self-service frontend located at `/(vendor-portal)/vendor-portal`.

```
                  +-----------------------------------+
                  |  Vendor User (role: VENDOR)       |
                  +-----------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
            v                       v                       v
   [ Events & Assignments ]   [ Bids & Proposals ]   [ Payouts & Bills ]
   (/vendor-portal/events)   (/vendor-portal/bids)   (/vendor-portal/payouts)
```

---

## 🔐 Security & Data Scoping

- **Role Gate**: Gated by permission `vendor-portal:access` (`session.user.role === "VENDOR"`).
- **Deterministic Binding**: `getCurrentVendor(session.user.email)` queries `prisma.vendor` by case-insensitive email match, ensuring strict multi-tenant vendor data isolation.
