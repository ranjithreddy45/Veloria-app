# Google Ads offline conversions

Google Ads only optimises toward what it is told. Until this shipped it knew
about form submissions and nothing else, so it bid for whoever filled a form
fastest: 346 Google Ads leads, none of them ever won.

Two things now flow back to Google: **CRM - Qualified lead** (flat ₹5,000) when
a lead is qualified, and **CRM - Booking (Won)** (the real booking value) when it
is won.

## The feed

`GET https://app.theveloriagrand.com/api/exports/gads-conversions.csv`

HTTP Basic Auth, credentials from `GADS_FEED_USER` and `GADS_FEED_PASS`. With
neither set the endpoint refuses everyone, including Google.

```
Parameters:TimeZone=Asia/Calcutta
Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
Cj0KCQ...,CRM - Qualified lead,2026-09-24 15:32:10,5000,INR
Cj0KCQ...,CRM - Booking (Won),2026-10-02 11:05:44,145000,INR
```

The last 30 days are listed on every fetch. Re-listing is deliberate — Google
skips exact duplicates, and it means a failed fetch repairs itself the next day
instead of losing conversions.

A row is dropped when the conversion time is in the future, earlier than the
lead itself, or more than 90 days after it. Those are the three things Google
rejects, and a rejected row takes the whole file's credibility with it.

### Setting it up in Google Ads

Tools → Conversions → Uploads → Schedule → HTTPS URL. Paste the URL, choose
Basic Auth, enter the username and password, set it to daily. The conversion
action names in the file must match the account character for character; a
mismatch is silent, and Google accepts the file while dropping every row.

## What makes a lead Qualified

Server-side, on every path that can set the status — the lead page, the list,
bulk actions, the pipeline drag, macros, workflows, CSV import and the API:

- an event date
- a guest count of at least 50
- an event type
- the customer confirmed Hosa Road works (a tick on the lead page)

Won additionally requires the booking value in rupees. Converting a deal into a
booking fills that in from the booking itself.

`qualifiedAt` and `wonAt` are written the first time each status is reached and
never moved afterwards, because Google reads a new time as a new conversion.

## Click IDs on the marketing site

`public/embed/enquiry-form.js` already captures `gclid`, `gbraid`, `wbraid` and
`fbclid` and now keeps them in a first-party cookie for 90 days, so a visitor
who lands on an ad and submits three pages later still carries the click.

For a form that does **not** use the embed, this is the whole integration:

```html
<script>
(function () {
  var PARAMS = ["gclid", "gbraid", "wbraid", "fbclid"];
  var DAYS = 90;
  function read(n) {
    var m = document.cookie.match(new RegExp("(^|;\\s*)" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : "";
  }
  function write(n, v) {
    document.cookie =
      n + "=" + encodeURIComponent(v) + "; expires=" +
      new Date(Date.now() + DAYS * 864e5).toUTCString() + "; path=/; SameSite=Lax";
  }
  var url = new URLSearchParams(location.search);
  PARAMS.forEach(function (p) {
    var live = url.get(p);
    if (live) write("vg_" + p, live);
  });
  // Call this when the form is submitted and merge the result into the payload.
  window.veloriaClickIds = function () {
    var out = {};
    PARAMS.forEach(function (p) {
      var v = url.get(p) || read("vg_" + p);
      if (v) out[p] = v;
    });
    return out;
  };
})();
</script>
```

Post the form to `POST https://app.theveloriagrand.com/api/landing-lead` with a
flat JSON body. It already accepts these names and ignores anything else:

| Field | Notes |
|---|---|
| `name` | required |
| `phone` | required, 10-digit mobile |
| `email` | optional |
| `eventType` | free text, e.g. "Wedding Ceremony / Reception" |
| `guests` | number |
| `date` | event date, `yyyy-mm-dd` |
| `gclid`, `gbraid`, `wbraid`, `fbclid` | from `window.veloriaClickIds()` |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | optional |
| `page` | the URL the form was on |

The endpoint is open by CORS allowlist rather than a key; add new origins to
`LANDING_LEAD_ORIGINS`.

## Backfill

```bash
npx tsx scripts/backfill-gads-conversions.ts            # dry run, writes the CSV
npx tsx scripts/backfill-gads-conversions.ts --write    # also stamps the leads
```

There is no lead status history in this database, so the stamps come from
`updatedAt`, clamped to each lead's own lifetime. Add `--strict` to apply the
new Qualified rules to the history as well — it emits nothing today, because
both ad webhooks used to discard the event date, guest count and event type.
