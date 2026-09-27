# Sidebar vs Route & Page Component Reconciliation

## 1. Reconciliation Overview
- **Total Declared Navigation Links in Sidebar**: 184 Leaf Items.
- **Matched Active Page Components**: 178 Page Files (`src/app/(dashboard)/*`).
- **Feature-Flag Gated Routes**: 4 Routes (`/leads/sla`, `/leads/war-room`, `/leads/missed-calls`, `/leads/cooling` under `LEAD_OPS_PAGES_ENABLED`).
- **Unlinked / Detail / Modal Routes**: Detail screens (e.g., `/bookings/[id]`, `/quotations/[id]`, `/contracts/[id]`, `/invoices/[id]`) do not appear directly in the sidebar tree; they are navigated to from parent list pages.

## 2. Category Breakdown
- **MATCH**: Sidebar link directly loads a corresponding Next.js Page component.
- **FEATURE_FLAG_GATED**: Rendered conditionally based on feature flags in `src/config/feature-flags.ts`.
- **UNLINKED_DETAIL**: Valid screen route not in sidebar (e.g., detail/edit modals or sub-pages).
