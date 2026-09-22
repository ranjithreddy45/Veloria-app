# 41 Project Brief vs. Code Discrepancies

`CODE VERIFIED`

## Forensic Comparison Table

| Feature Claim | Brief Requirement | Code Status | Empirical Discrepancy Note |
| :--- | :--- | :--- | :--- |
| **Dedicated Employee Portal** | Separate portal for employee self-service | `DIFFERENT IMPLEMENTATION` | Integrated into main internal dashboard (`/staff`, `/leave`, `/payroll`) via RBAC rather than standalone portal route group. |
| **Client Native Mobile Apps** | Native iOS/Android app store builds | `PARTIAL` | Implemented as Next.js PWA wrapped via Capacitor 8.1 (`(guest)/app`). |
| **Client Real-Time Video Feed** | Live CCTV feed of setup | `NOT FOUND` | No streaming video integration found in codebase. |
