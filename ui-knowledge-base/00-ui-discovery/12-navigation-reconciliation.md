# Phase 00: Navigation Reconciliation

## 1. Navigation vs Screen Reconciliation
- **Sidebar Navigation Entries**: 184 Leaf Items (`ui-knowledge-base/04-navigation/`).
- **Discovered Screen Routes**: 482 Page Files in `src/app/`.
- **Reconciliation Analysis**:
  - 178 Page Files match 1:1 with Sidebar Leaf Links.
  - 4 Page Files are feature-flag gated (`LEAD_OPS_PAGES_ENABLED`).
  - 300+ Page Files represent detail screens (`[id]`), create/edit forms (`/new`), public experience tokens (`/q/[token]`), print renderers (`/(print)/*`), and portal sub-pages accessed via parent lists.
