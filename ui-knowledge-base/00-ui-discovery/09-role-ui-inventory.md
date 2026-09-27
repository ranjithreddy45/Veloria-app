# Phase 00: Role-Specific UI Inventory

## 1. UI-Level RBAC Controls
- **Action Button Guarding**: Action buttons (e.g. "Approve Payroll", "Post Journal", "Lock BEO") check `hasPermission()` before rendering.
- **Read-Only Field Enforcement**: Non-privileged roles see plain text display instead of editable input fields.
- **Self-Service Restrictions**: `EMPLOYEE_USER` role views only `/me/*` routes and personal handbook, hiding administrative panels.
- **Portal Boundary Isolation**: Client and Vendor users are locked inside `/portal/*` and `/vendor-portal/*` containers.
