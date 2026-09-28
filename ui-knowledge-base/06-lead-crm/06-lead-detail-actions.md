# LEAD DETAIL ACTIONS FORENSICS

## 1. Action Inventory (`ACTION-0601` to `ACTION-0610`)

| Action ID | Action Label | Component File | Server Action Invoked | Side Effect / Result |
|---|---|---|---|---|
| **ACTION-0601** | `Create Quotation` | `LeadQuickActions` | Redirects to `/quotations/new?leadId=...` | Pre-fills quotation form with lead details |
| **ACTION-0602** | `Schedule Site Visit` | `ScheduleSiteVisitDialog` | `scheduleSiteVisit()` | Creates site visit record, sends SMS invite |
| **ACTION-0603** | `Update Status` | `LeadStatusSelect` | `updateLeadStatus()` | Updates `lead.status`, logs activity |
| **ACTION-0604** | `Update Quality` | `LeadQualitySelect` | `updateLeadQuality()` | Updates quality grade (`HOT`, `WARM`, `COLD`) |
| **ACTION-0605** | `Assign Owner` | `AssignOwnerPopover` | `assignLead()` | Reassigns `assignedToId`, dispatches email |
| **ACTION-0606** | `Add Note` | `CrmNotesPanel` | `createCrmNote()` | Appends note to lead timeline |
| **ACTION-0607** | `Schedule Task` | `ScheduleTaskDialog` | `createCrmTask()` | Creates follow-up task |
| **ACTION-0608** | `Convert Lead` | `LeadQuickActions` | `convertLeadToCustomer()` | Creates `Customer` entity, locks lead |
| **ACTION-0609** | `Delete Lead` | `LeadDeleteButton` | `deleteLead()` | Deletes lead record (Admin only) |
