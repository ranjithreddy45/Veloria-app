# LEAD ASSIGNMENT & OWNERSHIP FORENSICS

## 1. Assignment Mechanisms

Leads can be assigned through 3 mechanisms:

1. **Auto-Assignment**: Round-robin assignment rule on webform/API capture.
2. **Manual Single Assignment**: `AssignOwnerPopover` on table row or detail page.
3. **Bulk Assignment**: `BulkAssignPopover` on multi-row selection.

- **Notification Side Effect**: Executing assignment dispatches `sendLeadAssignedEmail()` to the rep.
