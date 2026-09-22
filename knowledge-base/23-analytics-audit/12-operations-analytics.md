# 12 BEO & Operations Readiness Analytics

`CODE VERIFIED`

## Operational Readiness Watchdog (`src/actions/operations.actions.ts`)

- **BEO Finalization SLA**: Monitors whether Banqueting Event Orders are finalized 7 days prior to event date.
- **Readiness Score %**: Aggregates completion status of vendor assignments, staff scheduling, kitchen prep plan, and client sign-off.
- **Incidents & Escalations**: Tracks operational incidents (`BeoIncident`) and escalation rules triggered during live events.
