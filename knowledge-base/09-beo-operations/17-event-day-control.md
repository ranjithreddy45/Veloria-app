# 17 - Event-Day Operational Control & Day-Of Execution

---

## 🎛️ Event-Day Complementary Routes

Veloria Grand provides 2 dedicated routes for event-day management:

1. **Event Control Dashboard (`/bookings/[bookingId]/control`)**:
   - Master operational control hub rendering readiness scores, emergency protocol launcher (`src/actions/emergency.actions.ts`), BEO incident logger (`addBeoIncident`), and event sign-off.
2. **Day-Of Execution Board (`/bookings/[bookingId]/day-of`)**:
   - Real-time run-of-show timeline execution (`EventDayTimeline`) and staff shift check-in tracking (`StaffAssignment`).

---

## 🚨 Emergency Operations Integration (`src/actions/emergency.actions.ts`)

- **Emergency Protocols**: Fetches venue emergency procedures (`getProtocols`).
- **Incident Reporting**: Invokes `reportIncident()` to capture emergency type, description, severity, photo evidence, and trigger instant notification alerts.
- **Incident Resolution**: Invokes `resolveIncident()` with resolution notes.
