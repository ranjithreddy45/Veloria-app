# Route Permission Matrix

## Overview

Definitive matrix mapping route categories to required permissions and middleware rules.

---

## Route Permission Overview

| Route Category | Authentication Required | Primary Permission Key | Allowed Roles |
|---|---|---|---|
| Dashboard Core | Yes | `dashboard:read` | All Staff Roles |
| Sales & Leads | Yes | `sales:read` | `SALES_EXEC`, `SALES_HEAD`, `ADMIN`, `SUPER_ADMIN` |
| BEO & Events | Yes | `events:read` | `EVENT_COORDINATOR`, `OPERATIONS_HEAD`, `ADMIN` |
| HR & Payroll | Yes | `hr:read` | `HR_EXECUTIVE`, `HR_MANAGER`, `ADMIN` |
| Finance & Billing | Yes | `finance:read` | `FINANCE`, `AUDITOR`, `ADMIN` |
| Client Portal | Yes | `CLIENT` Role | `CLIENT` |
| Vendor Portal | Yes | `VENDOR` Role | `VENDOR` |
| Public / Guests | No | N/A | Everyone |
