# Contract Template & Variable System

## Overview

Legal contract template engine (`ContractTemplate` model & `src/lib/acq/contract-template.ts`).

---

## Variable Replacement Engine

- **Template Model**: Stores legal body text and array of variable tags (`variables: ["clientName", "eventDate", "grandTotal"]`).
- **Template Manager**: Managed via `/settings/contract-templates`.
- **Substitution Logic**: Replaces `{{variableName}}` tags dynamically with live database values at contract creation time.
