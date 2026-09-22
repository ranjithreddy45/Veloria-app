# 53 Project Brief vs Code Discrepancies

`CODE VERIFIED`

1. **Automatic Venue Creation**: Brief implied manual double entry to create venues after property acquisition. Code automatically bridges properties to `Venue` records via `ensureVenueForProperty()`.
2. **Onboarding Seed Tasks**: Brief mentioned generic onboarding checklists. Code hardcodes specific seed tasks (`ONBOARDING_SEED_TASKS`: Capex, Legal, Staffing, Kitchen).
3. **Multi-Level Approvals**: Brief claimed multi-tiered corporate committee approvals. Code relies on RBAC (`bd:write`, `bd:admin`) and stage transitions.
