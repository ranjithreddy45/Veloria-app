# Contract Detail & Editor Component Breakdown

## Overview

Interface components powering contract inspection, clause editing, template selection, and signature tracking.

---

## Component Inventory

- `contract-detail.tsx` (`src/app/(dashboard)/contracts/_components/`): Displays contract metadata, rendered HTML body, signer details, and audit timestamps.
- `contract-form.tsx`: Editor form for creating and editing contract clauses and variables.
- `contracts-table.tsx`: Master contract listing table with status badges and filters.
- `portal-sign-form.tsx` (`src/app/(portal)/portal/contracts/[contractId]/_components/`): Client portal signature component.
- `sign-pad.tsx` (`src/app/(public)/sign/[token]/_components/`): Canvas signature pad for drawing or typing digital signatures.
