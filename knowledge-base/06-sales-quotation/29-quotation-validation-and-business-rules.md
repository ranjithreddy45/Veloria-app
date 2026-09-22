# Quotation Validation & Business Rules

## Overview

Zod validation schemas and business logic constraints governing proposal calculations.

---

## Validation Schemas (`src/schemas/quote.schema.ts` & `pricing.schema.ts`)

- **`createQuoteSchema`**:
  - `guestCount`: Positive integer (min 1).
  - `eventDate`: Future date timestamp.
  - `discountPct`: Decimal between 0.00% and 50.00%.
- **`pricingRuleSchema`**:
  - `multiplier`: Decimal between 0.500 and 3.000 (e.g. 1.150 for 15% surge).
