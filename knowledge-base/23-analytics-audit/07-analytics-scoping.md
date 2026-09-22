# 07 Multi-Property / Venue & Tenant Scoping

`CODE VERIFIED`

## Data Isolation & Scoping Rules in Analytics

1. **Super Admin / Executive View**:
   - Accesses cross-venue aggregates (`venueId: undefined`).
2. **Venue Manager View**:
   - Queries explicitly enforce `where: { venueId: user.venueId }` across all booking, revenue, and inventory metrics.
3. **Departmental Scoping**:
   - HR and Payroll reports restrict data visibility based on user department permissions (`departmentId`).
