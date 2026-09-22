# 05 - BEO Detail & Editor Screen

---

## 🖥️ BEO Editor Interface (`/beo/[id]`)

```
+-----------------------------------------------------------------------------------+
| BEO HEADER: [BEO-2026-0108] Sharma Wedding Reception                   [PUBLISHED]|
| Booking: VG-BK-2026-0042 | Venue: Grand Ballroom | Date: 15 Oct 2026                 |
+-----------------------------------------------------------------------------------+
| SECTION 1: HEADCOUNT & COVERS                                                     |
| Covers: 500 Pax | Source: CONTRACTED (Agreed Guarantee) | Updated: Today 10:00 AM   |
| [Switch Source: CONTRACTED | RSVP_CONFIRMED | MANUAL]                             |
+-----------------------------------------------------------------------------------+
| SECTION 2: RUN OF SHOW TIMELINE                                                   |
| - 04:00 PM | Hall Setup & Decor Check | Owner: Decor Team                         |
| - 06:30 PM | Guest Arrival & Welcome Drinks | Owner: Service Staff                |
| - 08:00 PM | Main Buffet Opening | Owner: Head Chef                               |
| - 11:00 PM | Event Teardown & Handover | Owner: Night Shift Manager            |
+-----------------------------------------------------------------------------------+
| SECTION 3: OPERATIONAL INCIDENTS                                                  |
| - [MEDIUM] Stage Light Transformer Blown | Status: RESOLVED | Reported By: R. Verma |
| [+ Log New Incident]                                                              |
+-----------------------------------------------------------------------------------+
```

---

## ⚙️ Interactive Controls & Action Mapping

| Button / UI Control | Target Server Action | Required Role | State Effect |
|---|---|---|---|
| **Save Draft** | `updateBeo(beoId, data)` | Ops Manager, Coordinator | Updates run-of-show JSON, notes, covers |
| **Publish BEO** | `setBeoStatus(beoId, 'PUBLISHED')` | Ops Head, Admin | Sets status = `PUBLISHED`, dispatches alerts |
| **Lock BEO** | `setBeoStatus(beoId, 'LOCKED')` | Ops Head, Admin | Sets status = `LOCKED`, freezes specs |
| **Log Incident** | `addBeoIncident(beoId, data)` | Ops Staff | Mints `BeoIncident` record |
| **Resolve Incident** | `resolveBeoIncident(incidentId)` | Ops Head, Admin | Updates incident status = `RESOLVED` |
