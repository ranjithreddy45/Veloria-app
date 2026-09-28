# DASHBOARD TABLE FORENSICS

## 1. Data Grid Architecture

Dashboard embedded tables use Radix UI primitives and Tailwind CSS styling, supporting pagination, sorting, and inline row actions.

---

## 2. Core Dashboard Tables

### TABLE-0501: Overdue Receivables Table (`SideCard` / `/finance`)
- **Columns**: Customer Name, Invoice #, Amount Due, Due Date, Action
- **Row Action**: `"Send Reminder"` or `"View Invoice"`
- **Click Behavior**: Navigates to `/invoices/[id]`.

### TABLE-0502: Today's Events Table (`SideCard` / `/beo`)
- **Columns**: Event Name, Venue Hall, Guest Count, Timing, BEO Status
- **Row Action**: `"Open BEO"`
- **Click Behavior**: Navigates to `/beo/[id]`.

### TABLE-0503: Unassigned Leads Table (`AttentionFeed` / `/leads`)
- **Columns**: Contact Name, Source, Received Time, SLA Status, Action
- **Row Action**: `"Assign Rep"` (Opens assignment modal)
- **Click Behavior**: Triggers `assignLeadAction()`.
