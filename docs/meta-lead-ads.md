# Meta lead ads into the CRM

Leads submitted on any instant form on The Veloria Grand page reach the CRM
within about a minute, and keep arriving even when a delivery fails.

## Why it was rebuilt

The old connection used a personal Facebook token. It died the moment its owner
logged out, on 22 September at 2:30 pm. Every delivery after that was received
and thrown away: **275 leads**, none of which reached the CRM. Nothing noticed,
because a broken integration and a quiet one look identical from the inside.

So this version does three things the old one did not: it survives a slow Graph
call, it polls for anything the webhook never delivered, and it tells somebody
when the token dies.

## The three paths

| Path | When | What it does |
|---|---|---|
| Webhook | Instantly | `/api/meta/leadgen` verifies the signature, records the lead ID, answers Meta, then fetches |
| Queue drain | Every 5 minutes | Retries any fetch that failed, with widening gaps |
| Poll | About every 15 minutes | Asks Meta for leads it never delivered at all |

A lead can therefore arrive three separate ways and still only exist once:
everything dedupes on Meta's own lead ID.

## Environment

```
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=          # any long random string; the same one goes in the App Dashboard
META_PAGE_ID=802807212921032
META_PAGE_ACCESS_TOKEN=     # System User token. Never a personal one
META_GRAPH_VERSION=v21.0
```

These are read first. If they are unset, the app falls back to Settings,
Integrations, Lead Capture, Facebook, so a dead token can be replaced from the
screen without a deploy. Neither source is ever logged.

## What Ranjith has to do

1. **App:** at developers.facebook.com, use CRM Connect (4694920844156459) if you
   are an admin on it, or create a Business app on The Veloria Grand portfolio.
2. **System user:** Business Settings, Users, System Users, Add, with the Admin
   role. Assign it the app and The Veloria Grand page with full control.
   Generate a token with `leads_retrieval`, `pages_manage_metadata`,
   `pages_show_list`, `pages_read_engagement`, `ads_management` and
   `business_management`. Choose never-expiring.
3. **Page token:** call `GET /me/accounts` with that token and take the
   `access_token` for page 802807212921032. That is `META_PAGE_ACCESS_TOKEN`.
4. **Webhook:** in the app, Webhooks, Page, callback URL
   `https://app.theveloriagrand.com/api/meta/leadgen`, verify token =
   `META_VERIFY_TOKEN`. Deploy first, because Meta calls the URL to verify it.
   Then subscribe to the **leadgen** field.
5. **Subscribe the page:**
   `curl -X POST "https://graph.facebook.com/v21.0/802807212921032/subscribed_apps?subscribed_fields=leadgen&access_token=<PAGE_TOKEN>"`
   should return `{"success":true}`.
6. **Leads access:** Business Settings, Integrations, Leads access. Make sure
   the app is allowed.
7. **Clean up:** remove the dead TeleCRM and Pabbly installs so the failure
   notices stop.

## Importing what was missed

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://app.theveloriagrand.com/api/cron/meta-leads?since=2026-09-23"
```

That pulls in the six birthday leads. Widen the date to reach further back;
Meta keeps lead data for about 90 days, so the 275 lost leads are recoverable
until roughly the end of December.

Running it twice imports nothing twice.

## Checking it is alive

`/api/cron/meta-health` runs daily and alerts every admin when the token is
dead or the page is no longer subscribed. It also warns when the token is a
personal one, because that is the failure that already happened once.

## Two things the spec assumed that are not true here

**There is no Conversions API stage feedback.** The spec says the CRM already
sends QUALIFIED, LOST, Contacted and Not Connected events to dataset
1354556783271464. It does not: nothing in this codebase posts events to Meta at
all. Meta's lead ID is now stored on every lead (`MetaLeadCapture.metaLeadId`),
which is what such a sender would need, but the sender itself has to be built.

**Owner partnership leads are marked, not routed.** The CRM's owner pipeline
requires a property name, type, city, locality and a BD owner. The Meta owner
form asks for none of those, and inventing them would put fiction in the BD
pipeline. So those leads are captured, left unassigned, and marked
`[OWNER PARTNERSHIP]` in the note with `pipeline = owner_partnership` on the
capture record. To route them properly, either add those questions to the form
or have BD pick them up from that filter.
