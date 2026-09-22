# 63 Project Brief vs Code Discrepancies

`CODE VERIFIED`

1. **Requisition Approval**: Brief claimed formal multi-level requisition approvals. Code consolidates requisitions directly into `RecJobOpening`.
2. **Offer Salary Handoff**: Brief implied automatic creation of payroll salary structures upon candidate hiring. Code writes offered CTC into `Employee.notes` as text; HR must manually configure `HrSalaryStructure`.
3. **User Account Creation**: Brief implied automatic login creation upon hiring. Code requires manual user account provisioning.
4. **Offer Expiry**: Brief claimed automatic offer expiration. Code requires manual status updates.
