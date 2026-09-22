# 21 - Event Day Incident Management

---

## 🚨 BEO & Emergency Incident Capture

Veloria Grand provides two levels of incident reporting:

### 1. BEO Incidents (`BeoIncident`)
- **Action**: `addBeoIncident(beoId, data)` & `resolveBeoIncident(incidentId)` in `src/actions/beo.actions.ts`.
- **Fields**: `title`, `description`, `severity` (`LOW`, `MEDIUM`, `HIGH`), `status` (`OPEN`, `RESOLVED`), `photoUrl`.
- **Purpose**: Operational bottlenecks (e.g. stage light blown, steward shortage).

### 2. Emergency Incidents (`EmergencyIncident`)
- **Action**: `reportIncident()` & `resolveIncident()` in `src/actions/emergency.actions.ts`.
- **Fields**: `bookingId`, `protocolId`, `type`, `description`, `severity`, `status`, `resolvedAt`.
- **Purpose**: Critical safety/fire/medical emergencies requiring instant protocol escalation.
