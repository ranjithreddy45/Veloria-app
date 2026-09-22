# Contract Validation & Business Rules

## Overview

Zod validation schemas and server-side business logic governing contract creation and digital signatures.

---

## Validation Schemas (`src/schemas/contract.schema.ts`)

- **`createContractSchema`**:
  - `title`: String min(3).
  - `content`: Non-empty HTML / markdown text.
  - `contactId`: Required foreign key to `Contact`.
- **`signatureSchema`**:
  - `signatureData`: Non-empty base64 string or typed name.
  - `signatureType`: Enum (`TYPED` or `DRAWN`).
