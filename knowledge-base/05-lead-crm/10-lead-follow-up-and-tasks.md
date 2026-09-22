# Lead Follow-Up, Reminders & Tasks

## Overview

Follow-up tracking ensures sales executives do not abandon active leads.

---

## Technical Features

- **Follow-Up Date**: `Lead.followUpDate` field specifies next scheduled contact date.
- **Follow-Up Queue Page**: `/leads/followups` lists all leads with overdue or today's follow-up deadline.
- **Task Association**: System allows creating `Task` records linked to `leadId` for specific reminders (e.g., "Send revised menu").
- **Speed to Lead SLA**: `src/actions/speed-to-lead.actions.ts` tracks `firstContactDue` (5-minute deadline from capture) and escalates SLA breaches.
