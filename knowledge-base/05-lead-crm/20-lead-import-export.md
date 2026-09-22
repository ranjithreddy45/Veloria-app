# Lead Import & Export Mechanics

## Overview

Bulk import of lead data from CSV/Excel spreadsheets and export to CSV.

---

## Import Architecture (`/leads/import`)

- **Client Component**: `src/app/(dashboard)/leads/import/_components/lead-import-client.tsx`.
- **Parsing & Validation**: `src/lib/sales/lead-import.ts` validates phone numbers, maps custom CSV column headers to `Lead` fields, and dedupes contacts.
- **Server Action**: `importLeadsBatch()` in `src/actions/lead-import.actions.ts`.
