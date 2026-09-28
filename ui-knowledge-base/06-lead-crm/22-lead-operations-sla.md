# LEAD OPERATIONS & SLA FORENSICS

## 1. Speed-to-Lead SLA Cockpit (`/leads/sla`)

Implemented in [sla-cockpit.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/sla/_components/sla-cockpit.tsx).

- **SLA Threshold**: 15 minutes response window for new web/WhatsApp leads.
- **SLA Breached Indicator**: Flashing red badge on leads breaching 15-minute response window.
- **SLA War Room (`/leads/war-room`)**: Real-time countdown board (`SlaCountdown`) prioritizing breached leads for immediate takeover.
