# 48 Cross-Portal Capability Comparison Matrix

`CODE VERIFIED`

| Capability | Client Portal | Vendor Portal | Guest App | Public Token Links | Staff Dashboard |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | NextAuth Session | NextAuth Session | Optional / PWA | Cryptographic Token | NextAuth Session |
| **View Bookings** | `READ (OWN)` | `READ (ASSIGNED)`| `READ (EVENT)` | `NOT AVAILABLE` | `READ/WRITE (ALL)` |
| **View Financials** | `READ (OWN)` | `READ (PAYOUTS)` | `NOT AVAILABLE` | `READ (INVOICE)` | `READ/WRITE (ALL)` |
| **Sign Contracts** | `SIGN` | `NOT AVAILABLE` | `NOT AVAILABLE` | `SIGN` | `MANAGE` |
| **Submit Bids** | `NOT AVAILABLE` | `SUBMIT` | `NOT AVAILABLE` | `NOT AVAILABLE` | `REVIEW/APPROVE` |
| **RSVP / Guests** | `WRITE (MANAGE)`| `NOT AVAILABLE` | `RSVP` | `RSVP` | `READ/WRITE` |
