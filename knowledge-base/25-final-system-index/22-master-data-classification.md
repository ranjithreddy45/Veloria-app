# Phase 22: Master Data Classification

| Classification Level | Data Types | Access Scope | Protection Controls |
|---|---|---|---|
| **PUBLIC** | Public quotation view, venue photos, public hold status | Unauthenticated | Public token verification |
| **INTERNAL** | Lead names, event calendar dates, inventory items, vendor list | Dashboard Roles | NextAuth session + RBAC |
| **CONFIDENTIAL** | Client contracts, quotations, property acquisition deals | Sales & Management Roles | Strict RBAC permission checks |
| **FINANCIAL** | Chart of accounts, General Ledger entries, bank accounts, invoices | Finance & Executive Roles | Immutable audit & Finance RBAC |
| **PERSONAL** | Employee personal records, candidate resumes, contact info | HR & Recruiter Roles | Role-restricted access |
| **SENSITIVE PERSONAL**| PAN, Aadhaar, bank details, salary structures | HR Director & Admin | Encrypted DB storage & strict RBAC |
| **SECURITY SENSITIVE**| Password hashes, API keys, JWT secrets, webhook tokens | System Core Only | Environment variable protection |
