# Lead Profile & Detail View

## Overview

The Lead Detail page (`/leads/[leadId]`) serves as the command center for reviewing lead details, updating status/quality, scheduling site visits, viewing AI scores, and logging communications.

---

## Interface Components (`src/app/(dashboard)/leads/[leadId]/_components/`)

- `lead-detail.tsx`: Main layout container displaying lead overview and contact information.
- `ai-score-card.tsx`: Displays AI score (0-100), AI score reasoning summary, and score timestamp.
- `lead-status-select.tsx`: Inline status dropdown trigger (`NEW` -> `QUALIFIED` -> `WON` / `LOST`).
- `lead-quality-select.tsx`: Quality classification (`QUALIFIED`, `JUNK_PRICE_ONLY`, `DUPLICATE`, etc.).
- `schedule-site-visit-dialog.tsx`: Modal dialog for booking venue site visits.
- `lead-quick-actions.tsx`: Call, WhatsApp, email, and task creation action bar.
