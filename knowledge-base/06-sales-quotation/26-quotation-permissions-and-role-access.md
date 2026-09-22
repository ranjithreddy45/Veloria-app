# Quotation Permissions & Role Access Matrix

## Overview

Role-Based Access Control (RBAC) rules governing quotation creation, editing, approval, and deletion.

---

## Role Access Matrix

| Role | View Quotes | Create Quote | Edit Quote | Approve Quote | Delete Quote |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | Yes (All) | Yes | Yes | Yes | Yes |
| `ADMIN` | Yes (All) | Yes | Yes | Yes | Yes |
| `SALES_HEAD` | Yes (All) | Yes | Yes | Yes (<= 20%) | Yes |
| `SALES_EXEC` | Yes (Assigned) | Yes | Yes (DRAFT) | No | No |
| `FINANCE` | Read-only | No | No | No | No |
| `CLIENT` | View Own (`/q/[token]`) | No | No | Accept / Pay | No |
