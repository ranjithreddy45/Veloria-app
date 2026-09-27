# LEAD CRM SCREEN REGISTRY

## 1. Registry Summary

The Veloria Grand Lead CRM system consists of 12 distinct UI screens and command surfaces.

---

## 2. Comprehensive Screen Registry

### SCREEN-0601: Main Lead Inbox (`/leads`)
- **Route**: `/leads`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/page.tsx)
- **Screen Name**: Lead Inbox & Master Table
- **Primary Roles**: `SALES`, `ADMIN`, `GENERAL_MANAGER`
- **Widgets**: `LeadsStatStrip`, `LeadsFilterBar`, `WorkStrip`, `LeadsTable`, `AssignOwnerPopover`, `BulkAssignPopover`
- **Server Action**: `getLeads()` ([lead.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/lead.actions.ts))
- **Status**: Verified from Source Code.

### SCREEN-0602: New Lead Form (`/leads/new`)
- **Route**: `/leads/new`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/new/page.tsx)
- **Screen Name**: Create Lead Form
- **Primary Roles**: `SALES`, `ADMIN`
- **Components**: `LeadForm` ([lead-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/_components/lead-form.tsx))
- **Server Action**: `createLead()`
- **Status**: Verified from Source Code.

### SCREEN-0603: Lead Detail Profile (`/leads/[leadId]`)
- **Route**: `/leads/[leadId]`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/[leadId]/page.tsx)
- **Screen Name**: Lead Detail & Activity Hub
- **Primary Roles**: All Sales & Admin
- **Components**: `LeadQuickActions`, `LeadInlineFields`, `AiScoreCard`, `LeadSiteVisits`, `LeadStatusSelect`, `LeadQualitySelect`, `CrmNotesPanel`, `ScheduleTaskDialog`, `ScheduleSiteVisitDialog`
- **Status**: Verified from Source Code.

### SCREEN-0604: Edit Lead (`/leads/[leadId]/edit`)
- **Route**: `/leads/[leadId]/edit`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/[leadId]/edit/page.tsx)
- **Screen Name**: Edit Lead Form
- **Components**: `LeadForm` (in edit mode)
- **Server Action**: `updateLead()`
- **Status**: Verified from Source Code.

### SCREEN-0605: Lead Bulk CSV Import (`/leads/import`)
- **Route**: `/leads/import`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/import/page.tsx)
- **Screen Name**: Lead CSV Importer
- **Components**: `LeadImportClient`
- **Server Action**: `importLeadsAction()`
- **Status**: Verified from Source Code.

### SCREEN-0606: Lead Follow-ups Queue (`/leads/followups`)
- **Route**: `/leads/followups`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/followups/page.tsx)
- **Screen Name**: Follow-ups & Reminders Center
- **Status**: Verified from Source Code.

### SCREEN-0607: Speed-to-Lead SLA Cockpit (`/leads/sla`)
- **Route**: `/leads/sla`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/sla/page.tsx)
- **Screen Name**: Speed-to-Lead SLA Monitor
- **Components**: `SlaCockpit`
- **Status**: Verified from Source Code.

### SCREEN-0608: SLA War Room (`/leads/war-room`)
- **Route**: `/leads/war-room`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/war-room/page.tsx)
- **Screen Name**: SLA War Room & Countdown Board
- **Components**: `WarRoomBoard`, `SlaCountdown`
- **Status**: Verified from Source Code.

### SCREEN-0609: Missed Calls Board (`/leads/missed-calls`)
- **Route**: `/leads/missed-calls`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/missed-calls/page.tsx)
- **Screen Name**: Missed Calls Call-Back Queue
- **Components**: `MissedCallsBoard`
- **Status**: Verified from Source Code.

### SCREEN-0610: Cooling Leads Sweep (`/leads/cooling`)
- **Route**: `/leads/cooling`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/cooling/page.tsx)
- **Screen Name**: At-Risk & Cooling Leads Re-engagement
- **Components**: `RunSweepButton`
- **Status**: Verified from Source Code.

### SCREEN-0611: BD Lead Inbox (`/bd/leads`)
- **Route**: `/bd/leads`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/bd/leads/page.tsx)
- **Screen Name**: Business Development Lead Workspace
- **Components**: `LeadInbox`, `BdWorkStrip`, `ReassignOwnerPopover`
- **Status**: Verified from Source Code.

### SCREEN-0612: Site Visits Board (`/site-visits`)
- **Route**: `/site-visits`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/site-visits/page.tsx)
- **Screen Name**: Venue Site Visits Calendar & Board
- **Components**: `SiteVisitsBoard`
- **Status**: Verified from Source Code.
