# Chunk 03: User Roles, Permissions & RBAC System

## Overview

This directory contains the definitive technical documentation for the Veloria Grand Role-Based Access Control (RBAC) system, permission model, route authorization, Server Action security, API security, and role-family capabilities.

---

## Table of Contents

| Document | Title | Description |
|---|---|---|
| [01-rbac-overview.md](01-rbac-overview.md) | RBAC Architecture Overview | Core security concepts, user-role-permission model, and architecture diagram. |
| [02-role-inventory.md](02-role-inventory.md) | System Role Inventory | Complete reference table of all 23 application roles. |
| [03-permission-model.md](03-permission-model.md) | Permission System Architecture | Static & dynamic permission structures, database models, and wildcard bypasses. |
| [04-role-permission-matrix.md](04-role-permission-matrix.md) | Role x Capability Matrix | Definitive capability matrix mapping roles across application capabilities. |
| [05-route-authorization.md](05-route-authorization.md) | Route-Level Authorization | Middleware route matching, `routePermission` mapping, and access rules. |
| [06-server-action-authorization.md](06-server-action-authorization.md) | Server Action Authorization | Inspection of 15 key Server Actions and their security patterns. |
| [07-api-authorization.md](07-api-authorization.md) | API Authorization Model | Security mechanics for internal, public, cron, webhook, and portal APIs. |
| [08-resource-level-authorization.md](08-resource-level-authorization.md) | Resource Scoping & Ownership | Record-level scoping via `employeeId`, `clientId`, `vendorId`, and `departmentId`. |
| [09-navigation-visibility-and-access.md](09-navigation-visibility-and-access.md) | Navigation Visibility & Access | Dynamic sidebar filtering logic and UI vs backend security distinction. |
| [10-approval-authority-model.md](10-approval-authority-model.md) | Approval Authority Model | Multi-tier approval workflows for reimbursements, quotations, leave, and POs. |
| [11-role-by-module-access.md](11-role-by-module-access.md) | Role Access Across Modules | Summary of role accessibility across all functional application modules. |
| [12-super-admin.md](12-super-admin.md) | Role Deep Dive: SUPER_ADMIN | Comprehensive profile of the root administrator role. |
| [13-admin.md](13-admin.md) | Role Deep Dive: ADMIN | Profile of the business administrator role. |
| [14-sales-roles.md](14-sales-roles.md) | Role Family: Sales | Deep dive into `SALES_EXEC` and `SALES_HEAD`. |
| [15-event-and-operations-roles.md](15-event-and-operations-roles.md) | Role Family: Events & Operations | Deep dive into `EVENT_COORDINATOR`, `OPERATIONS`, and `OPERATIONS_HEAD`. |
| [16-finance-role.md](16-finance-role.md) | Role Deep Dive: FINANCE | Profile of the finance and accounting role. |
| [17-hr-roles.md](17-hr-roles.md) | Role Family: HR | Deep dive into `HR_EXECUTIVE` and `HR_MANAGER`. |
| [18-business-development-and-property-roles.md](18-business-development-and-property-roles.md) | Role Family: BD & Property | Deep dive into `BD_EXECUTIVE`, `BD_HEAD`, and `PROPERTY_MANAGER`. |
| [19-projects-design-legal-marketing-roles.md](19-projects-design-legal-marketing-roles.md) | Role Family: Projects, Design, Legal, Marketing | Specialized operational and professional roles. |
| [20-staff-client-vendor-auditor-access.md](20-staff-client-vendor-auditor-access.md) | General Staff, Portals & Auditor | Deep dive into `STAFF`, `CLIENT`, `VENDOR`, and `AUDITOR`. |
| [21-portal-role-boundaries.md](21-portal-role-boundaries.md) | Portal Boundaries & Isolation | External portal user isolation rules and security boundaries. |
| [22-role-lifecycle-and-user-management.md](22-role-lifecycle-and-user-management.md) | Role Lifecycle & User Management | User creation, role reassignment, suspension, and auditing. |
| [23-rbac-security-boundaries.md](23-rbac-security-boundaries.md) | RBAC Security Boundaries | The 8 defense-in-depth security layers. |
| [24-rbac-end-to-end-flows.md](24-rbac-end-to-end-flows.md) | End-to-End Sequence Flows | Mermaid sequence diagrams for core authorization paths. |
| [25-rbac-gaps-and-verification.md](25-rbac-gaps-and-verification.md) | Gaps & Verification Matrix | Factual audit matrix comparing implementation against requirements. |

---

## Status Summary

- **Total System Roles**: 23
- **Total Granular Permissions**: 244
- **Verification Status**: All documentation `CODE VERIFIED` against Veloria Grand source code.
