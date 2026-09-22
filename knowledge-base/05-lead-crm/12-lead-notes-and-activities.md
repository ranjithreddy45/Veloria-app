# Lead Notes & Activity Log

## Overview

Logs internal staff notes, status changes, assignment shifts, and customer interactions against the lead record.

---

## Database Models & Logging

- **`CrmNote` Model**: Stores rich text notes authored by sales staff (`leadId`, `authorId`, `content`).
- **`AcqLeadActivity` / `ActivityLog`**: System audit trail capturing automated events (e.g., "Status changed from NEW to QUALIFIED by John Doe").
