# 27 - Booking Automation & Cron Jobs

---

## ⏰ Automated Cron Job Census

| Cron Endpoint | Schedule | Purpose & Logic | Database Queries & Side Effects |
|---|---|---|---|
| `/api/cron/hold-expiry` | Every 15 Mins | Sweeps un-promoted date holds | Finds `Booking.status == 'HOLD'` & `holdExpiresAt < NOW()`, updates status = `CANCELLED` |
| `/api/cron/public-hold-expiry` | Every 5 Mins | Sweeps expired public hold tokens | Finds `PublicHold.status == 'INITIATED'` & `expiresAt < NOW()`, releases token |
| `/api/cron/event-lifecycle` | Daily @ 00:01 AM | Transitions active event states | Updates `CONFIRMED` -> `IN_PROGRESS` on event date, and `IN_PROGRESS` -> `COMPLETED` post event |
| `/api/cron/event-briefings` | Daily @ 06:00 AM | Sends operational briefings | Fetches today's events, dispatches BEO summaries to ops staff via WhatsApp |
| `/api/cron/guest-reminders` | Daily @ 09:00 AM | Sends RSVP reminders | Sends WhatsApp RSVP reminder links to unconfirmed guests |
| `/api/cron/winback-event-proximity` | Weekly | Triggers anniversary winback | Queries past completed events to trigger renewal/anniversary promotions |
