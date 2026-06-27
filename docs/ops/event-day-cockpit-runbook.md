# Event-Day Cockpit Runbook — Veloria Grand

How the team runs an event in the system, end to end. Keep this open on event day.
Fill in the **[names / numbers]** placeholders for your team once and reuse.

> **The one rule:** if it's not ticked in the app, it didn't happen. The cockpit is
> the single source of truth — work it, don't work around it.

---

## Roles & who owns what

| Role | In the app | Owns on the day |
|---|---|---|
| **Ops Head** *[name / phone]* | `OPERATIONS` / `ADMIN` | The whole event. Signs off readiness. Final call on go/no-go. |
| **Event Coordinator** *[name / phone]* | `EVENT_COORDINATOR` | Decor, catering, seating, entertainment, the client. |
| **Operations team** *[names]* | `OPERATIONS` | AV, housekeeping, logistics, security, dispatch. |
| **Kitchen lead** *[name / phone]* | (assigned tasks) | The food / F&B plan. |
| **Vendors** | confirm via WhatsApp link | Their own scope (decor, photography, etc.). |

Tasks auto-route to these teams by category. If a task lands on the wrong person, reassign it on the execution page.

---

## The three screens you'll use

| Screen | URL | What it's for |
|---|---|---|
| **Ops hub** | `/bookings/<id>/operations` | Readiness %, financials, **sign-off**, the function sheet (BEO), kitchen, procurement, logistics links, and the **client plan share link**. |
| **Live cockpit** | `/bookings/<id>/control` | The command centre on the day: live readiness, the run-of-show timeline with **NOW / NEXT** + countdowns, and the photo-proof list. **Mobile-friendly — use it on your phone.** |
| **Execution tasks** | `/bookings/<id>/execution` | The full task checklist — start, upload proof, complete, reassign. |

---

## Timeline

### T-3 days → T-24h — get to "ready"
1. Open the **Ops hub**. Work the **Readiness panel** top to bottom — every required gate must go green:
   - **Function sheet published** — open the BEO, confirm menu/floor/AV/decor/staffing notes, set status **Published**.
   - **Mandatory tasks complete** — clear the must-do prep tasks.
   - **Vendors confirmed** — every vendor must tap **Confirm** on their WhatsApp link. Chase the reds.
   - (Also: kitchen plan finalised, procurement **received**, dispatch ready, staff confirmed.)
2. The **Watchdog** will message the Ops Head daily with anything still open — treat that as your punch-list.
3. **Sign off.** When the required gates are green, the Ops Head clicks **Sign off readiness** on the Ops hub. *An event cannot be marked LIVE without this.* If a gate later regresses, **Revoke** and re-sign.

### Event morning — brief & set up
1. Everyone gets a **morning briefing** notification: their tasks for today + a cockpit link. Open it.
2. Open the **Live cockpit** on your phone. You'll see the run-of-show with the **NOW** task highlighted and **countdowns** ("AV check — in 25 min").
3. Work the timeline in order. As you start a task → **Start**; when done → **Complete**. Tasks marked 📷 **need a photo** (decor, AV, stage) — upload it before completing; the system won't let you skip it.
4. When you complete a task that others wait on, the next team is **auto-notified** ("Decor done — AV can start").

### During the event — keep it green
- Glance at the cockpit between cues. Anything overdue shows red.
- **Log issues as they happen** — use the incident capture (Support / BEO incident). A logged issue is one the Ops Head can see and act on.
- Don't chase people on WhatsApp for status — the cockpit *is* the status board.

### Wrap-up & close
1. Complete the wind-down + teardown + dispatch-return tasks.
2. Confirm equipment returned (logistics) and any rentals reconciled.
3. The event auto-completes; the review request goes to the client automatically.

---

## Quick "is everything ok?" check (10 seconds)
Open `/bookings/<id>/control` →
- **Readiness ≈ 100%?** ✅
- **No red/overdue tasks?** ✅
- **NOW task matches reality?** ✅
- **Signed off?** ✅

If any of those is off, see the **Crisis Escalation Sheet**.
