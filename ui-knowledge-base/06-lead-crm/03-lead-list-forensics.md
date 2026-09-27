# LEAD LIST SCREEN FORENSICS (`/leads`)

## 1. Page Layout & Component Architecture

The primary Lead Inbox ([page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/page.tsx)) renders a multi-part management surface.

```
┌──────────────────────────────────────────────────────────┐
│ LEADS INBOX                            [ + New Lead ]    │
│ Managing 142 total enquiries across active pipelines    │
├──────────────────────────────────────────────────────────┤
│ [ Stat Strip: Total: 142 | New: 24 | In Progress: 88 ]   │
├──────────────────────────────────────────────────────────┤
│ [ Filter Bar: Search | Status | Source | Owner | Date ]  │
├──────────────────────────────────────────────────────────┤
│ [ Master Leads Table (LeadsTable)                      ] │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Key Controls & Triggers

- **Header Primary Action**: `<Button asChild><Link href="/leads/new"><Plus className="mr-2 size-4"/>New Lead</Link></Button>`
- **Stat Strip Component**: `<LeadsStatStrip stats={stats} />` rendering counts for Total, New, Contacted, Qualified, Converted.
- **Filter Bar Component**: `<LeadsFilterBar />` with search input (debounced), status select, source dropdown, and owner filter.
- **Work Strip**: `<WorkStrip />` displaying urgent task count and overdue follow-up counts.
- **Bulk Action Popover**: `<BulkAssignPopover />` allowing multi-row owner assignment.
