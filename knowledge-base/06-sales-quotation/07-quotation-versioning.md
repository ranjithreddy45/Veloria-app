# Quotation Versioning System

## Overview

Tracks revision history when proposal terms, menu items, or discounts are updated.

---

## Versioning Mechanics

- **`SalesQuotation.version`**: Integer counter (defaults to `1`).
- **`SalesQuotationTransition`**: Logs historical state transitions, user IDs, and timestamps.
- **Inputs Freeze**: Upon status reaching `APPROVED`, `inputsJson` and `outputsJson` are frozen to ensure immutable auditability.
- **Revision Action**: Editing an approved quote increments `version` and resets status to `DRAFT` or `PENDING_APPROVAL`.
