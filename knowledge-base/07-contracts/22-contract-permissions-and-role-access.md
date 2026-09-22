# Contract Permissions & Role Access Matrix

## Overview

Role-Based Access Control (RBAC) rules governing contract drafting, template editing, signing, and deletion.

---

## Role Access Matrix

| Role | View Contracts | Create Contract | Edit Template | Sign Contract | Delete Contract |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | Yes (All) | Yes | Yes | Yes | Yes |
| `ADMIN` | Yes (All) | Yes | Yes | Yes | Yes |
| `LEGAL` | Yes (All) | Yes | Yes | Approve / Sign | No |
| `SALES_HEAD` | Yes (All) | Yes | Read-only | Send Link | No |
| `SALES_EXEC` | Yes (Assigned) | Yes | No | Send Link | No |
| `CLIENT` | View Own (`/sign/[token]`) | No | No | E-Sign (`/sign/[token]`) | No |
