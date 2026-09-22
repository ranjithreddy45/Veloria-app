# Lead Permissions & Role Access Matrix

## Overview

Access control rules governing Lead CRM capabilities across roles.

---

## Role Access Matrix

| Role | View Leads | Create Lead | Edit Lead | Assign Owner | Delete Lead | Export Leads |
|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | Yes (All) | Yes | Yes | Yes | Yes | Yes |
| `ADMIN` | Yes (All) | Yes | Yes | Yes | Yes | Yes |
| `SALES_HEAD` | Yes (All) | Yes | Yes | Yes | Yes | Yes |
| `SALES_EXEC` | Yes (Assigned) | Yes | Yes (Assigned) | No | No | No |
| `BD_HEAD` | Yes (BD Leads) | Yes | Yes | Yes | No | Yes |
| `BD_EXECUTIVE` | Yes (Assigned) | Yes | Yes (Assigned) | No | No | No |
| `OPERATIONS` | Read-only | No | No | No | No | No |
| `FINANCE` | Read-only | No | No | No | No | No |
| `CLIENT` | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden |
| `VENDOR` | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden |
