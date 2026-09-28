# Phase 00: Component Inventory

## 1. Executive Summary
This document catalogs the primary UI components rendered across Veloria Grand, categorized into global layout components, Shadcn/Radix primitive wrappers, domain-specific feature components, data visualization widgets, and interactive overlays.

## 2. Component Category Breakdown
- **Global Layout & Navigation**: `AppSidebar`, `AppHeader`, `PageHeader`, `BrandLogo`, `CommandPalette`, `NotificationPopover`, `ActiveAlertsPopup`, `PendingApprovalsChip`, `VelosChip`.
- **Domain Feature Components**:
  - *Lead CRM*: `LeadCard`, `LeadStatusBadge`, `SLAWatchdogBadge`, `LeadActivityTimeline`.
  - *Quotation & Sales*: `QuotationItemTable`, `PriceCalculatorWidget`, `TaxSummaryCard`, `PublicQuoteAcceptModal`.
  - *Contracts*: `CanvasSignaturePad`, `ContractStatusBadge`, `PDFStampOverlay`.
  - *Booking & Operations*: `VenueCalendarGrid`, `BeoReadinessGateCard`, `DayOfRunOfShowBoard`, `SeatingChartBuilder`.
  - *Kitchen & Inventory*: `RecipeCostingCard`, `StockReorderBadge`, `KitchenBatchPlanTable`.
  - *Finance & Payroll*: `DoubleEntryJournalRow`, `PayslipBreakdownCard`, `COATreeView`.

## 3. Representative Component Inventory (COMP-0001 to COMP-0010)

| Component ID | Component Name | Source File | Type | Purpose | Props / State |
|---|---|---|---|---|---|
| COMP-0001 | `AppSidebar` | `src/components/layout/app-sidebar.tsx` | Layout | Sidebar navigation & workspace pins | Permissions, Pins, User Profile |
| COMP-0002 | `AppHeader` | `src/components/layout/app-header.tsx` | Layout | Top header, venue selector & breadcrumbs | Active venue, user session |
| COMP-0003 | `CommandPalette` | `src/components/layout/command-palette.tsx` | Navigation | `Cmd+K` global search & quick jump | Open state, search query |
| COMP-0004 | `CanvasSignaturePad` | `src/components/contracts/sign-pad.tsx` | Interactive | HTML5 canvas signature pad | `onSave`, `onClear`, `penColor` |
| COMP-0005 | `LeadStatusBadge` | `src/components/crm/lead-status-badge.tsx` | Display | Lead status badge with color coding | `status: LeadStatus` |
| COMP-0006 | `BeoReadinessGateCard`| `src/components/beo/readiness-gate-card.tsx` | Display | 7-gate operational readiness indicator | `readiness: BeoReadiness` |
| COMP-0007 | `DoubleEntryJournalRow`| `src/components/finance/journal-row.tsx` | Form / List | Debit & Credit balancing row | `account`, `debit`, `credit` |
| COMP-0008 | `NotificationPopover`| `src/components/layout/notification-popover.tsx` | Overlay | Bell icon popover for system alerts | Notifications list |
| COMP-0009 | `PendingApprovalsChip`| `src/components/layout/pending-approvals-chip.tsx` | Widget | Header chip for pending manager approvals | Count badge |
| COMP-0010 | `VelosChip` | `src/components/layout/velos-chip.tsx` | Widget | Employee gamification points chip | Points total |
