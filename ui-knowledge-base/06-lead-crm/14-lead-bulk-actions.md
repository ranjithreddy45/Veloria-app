# LEAD BULK ACTIONS FORENSICS

## 1. Bulk Action Inventory

Accessible when 1 or more rows are selected in `LeadsTable`.

- **BULK-0601: Bulk Re-Assign Owner**
  - **Component**: `BulkAssignPopover`
  - **Server Action**: `bulkAssignLeads(leadIds, newOwnerId)`
  - **Result**: Reassigns owner across selected leads, sends email notifications.
- **BULK-0602: Bulk Status Update**
  - **Server Action**: `bulkUpdateLeadStatus(leadIds, newStatus)`
- **BULK-0603: Bulk Export to CSV**
  - Exports selected rows as downloadable CSV.
