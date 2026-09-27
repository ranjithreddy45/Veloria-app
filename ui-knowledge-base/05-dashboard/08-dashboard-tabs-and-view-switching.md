# DASHBOARD TABS & VIEW SWITCHING

## 1. View Switching Mechanisms

Dashboards utilize 2 primary view-switching patterns:

1. **Route-Based Sub-Tabs**: Using Next.js layout sub-navigation (`/finance`, `/finance/cash-flow`, `/finance/anomalies`).
2. **Local State Segmented Control**: Client-side toggles for switching views between Grid, List, and Kanban.

---

## 2. Tab Inventory

### TAB-0501: Tasks View Switcher (`/tasks`)
- **Component**: [tasks-views.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/tasks/_components/tasks-views.tsx)
- **Options**: `"Board"` (Kanban) vs `"List"` (Table) vs `"Calendar"`.
- **State Storage**: URL parameter `?view=board`.

### TAB-0502: WhatsApp Console Tabs (`/whatsapp/console`)
- **Options**: `"Inbox"`, `"Templates"`, `"Catalog"`, `"Analytics"`.
- **State Storage**: React state `[activeTab, setActiveTab]`.
