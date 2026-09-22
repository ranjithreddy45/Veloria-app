# Lead Validation & Business Rules

## Overview

Zod validation schemas and server-side business rules governing Lead CRM integrity.

---

## Validation Schemas (`src/schemas/lead.schema.ts`)

- **`createLeadSchema`**:
  - `title`: String min(2).
  - `contact.phone`: Validated E.164 phone string.
  - `contact.email`: Validated email address.
  - `guestCount`: Optional positive integer.
  - `estimatedValue`: Optional non-negative decimal.
- **`updateLeadStatusSchema`**:
  - Requires `status` in `LeadStatus` enum.
  - Requires `lostReason` when `status === "LOST"`.
