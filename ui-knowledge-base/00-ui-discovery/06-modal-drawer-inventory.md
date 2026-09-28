# Phase 00: Modal & Drawer Inventory

## 1. Master Dialog & Overlay Catalog
- **Total Discovered Modals & Drawers**: 64 Dialogs/Drawers.

## 2. Representative Overlay Inventory (MODAL-0001 to MODAL-0010)

| Modal ID | Trigger | Parent Screen | Component File | Contents / Actions |
|---|---|---|---|---|
| MODAL-0001 | Click "Quick Add Lead" | `/leads` | `src/components/crm/lead-dialog.tsx` | Quick lead submission form |
| MODAL-0002 | Click "Public Hold" | `/availability` | `src/components/booking/hold-modal.tsx` | Soft hold token generation |
| MODAL-0003 | Click "Lock BEO" | `/beo/[id]` | `src/components/beo/lock-dialog.tsx` | Read-only state confirmation |
| MODAL-0004 | Click "Record Payment" | `/invoices/[id]` | `src/components/invoices/payment-modal.tsx` | Cash/Gateway payment capture |
| MODAL-0005 | Click "Approve PR" | `/procurement` | `src/components/procurement/pr-approve-modal.tsx`| Maker-Checker approval dialog |
| MODAL-0006 | Click "Upload Proof" | `/me/reimbursements`| `src/components/hr/proof-upload-modal.tsx` | AWS S3 receipt upload dialog |
| MODAL-0007 | Click "Command Palette" | Global (`Cmd+K`) | `src/components/layout/command-palette.tsx` | Search input & shortcut links |
| MODAL-0008 | Click "Active Alerts" | Header | `src/components/layout/active-alerts-popup.tsx`| System alerts list popover |
| MODAL-0009 | Click "User Profile" | Sidebar Footer | `src/components/layout/app-sidebar.tsx` | Profile details & Sign Out |
| MODAL-0010 | Click "Filter" | Data Tables | `src/components/ui/filter-sheet.tsx` | Multi-select search drawer |
