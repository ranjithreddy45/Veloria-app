# Lead Qualification Process

## Overview

Qualification verifies that an inquiry has genuine commercial intent, budget alignment, and valid event parameters before advancing to quotation.

---

## Qualification Criteria & Fields

1. **`LeadQuality` Classification**: Updated via `lead-quality-select.tsx` (`QUALIFIED`, `JUNK_PRICE_ONLY`, `DUPLICATE`, etc.).
2. **Key Requirements**: Preferred venue, event date, guest count, slot (`Lunch` / `Dinner`), dietary preference (`Veg` / `Non-Veg`), and budget per plate (`perPlateBudget`).
3. **Server Action**: `updateLeadQuality()` in `src/actions/lead-quality.actions.ts`.
