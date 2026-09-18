# End-to-end smoke suite (Playwright)

Browser-level smoke tests for the dashboard app. They sign in as the seeded
SUPER_ADMIN, drive the real UI, and create their own uniquely-named data
(`E2E <thing> <timestamp>`), cleaning up through the UI where a delete exists.

| Spec | What it proves |
| --- | --- |
| `auth.spec.ts` | Wrong password errors, correct login lands on the dashboard, sign-out protects routes |
| `sales-leads.spec.ts` | `/leads/new` → list search → detail → status change → note → owner → delete |
| `quotation.spec.ts` | Lead → **Create Quotation** → calculator total renders → submit → approve |
| `bd-leads.spec.ts` | BD inbox **New Lead** dialog → stage chip filter → search → detail → delete |
| `hr-reimbursement.spec.ts` | `/me/reimbursements` claim → "Awaiting 1st approval" → History → `/me/approvals` Approve |
| `people.spec.ts` | `/people` loads (seeds the org on first run), search filters, Employee Handbook opens |
| `customer-app.spec.ts` | Customer app (`/app`) and team side show the same records: Business contact → Help, published policy → policy page, concierge message ↔ team reply, balance due (draft excluded), guest list, access boundary, VIEWER co-host limits |
| `customer-browse.spec.ts` | Browsing halls, signed out: the feed's pill + size chips + count line, the "Find a hall" sheet writing a date into the URL, availability that agrees with the hall's own calendar, card → hall page → **Reserve**, illustration honesty, the home screen's browse block |
| `smoke-routes.spec.ts` | ~40 key routes from `src/config/navigation.ts` render without the error boundary |

## Running locally

Prerequisites (one time):

```bash
docker compose up -d postgres        # local Postgres (veloria / veloria_db)
pnpm exec prisma db push             # schema
pnpm db:seed                         # creates admin@veloriagrand.com / Admin@123 + sample data
pnpm exec playwright install chromium
```

Then, with the app already running (`pnpm dev` or `pnpm build && pnpm start`):

```bash
pnpm test:e2e                 # headless, chromium
pnpm test:e2e:ui              # Playwright UI mode (pick tests, watch, time-travel)
pnpm test:e2e -- --headed     # watch the browser
pnpm test:e2e -- tests/e2e/auth.spec.ts   # a single spec
pnpm test:e2e -- -g "reimbursement"       # by title
```

Or let Playwright boot the server from an existing production build:

```bash
pnpm build
E2E_USE_WEBSERVER=1 pnpm test:e2e
```

Environment knobs:

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3000` | Where the app is |
| `E2E_USE_WEBSERVER` | unset | `1` → Playwright runs `pnpm start` and waits for `E2E_BASE_URL` |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | seed admin | Override the login used by global setup |
| `E2E_ADMIN_NAME` | `Rajesh Kumar` | Display name asserted after login (matches `prisma/seed.ts`) |

Reports and traces land in `tests/e2e/.report` and `tests/e2e/.results`
(both git-ignored via `tests/e2e/.gitignore`, along with the saved session
in `tests/e2e/.auth`). After a failure: `pnpm exec playwright show-report tests/e2e/.report`.

## How auth works

`global-setup.ts` logs in once through the real `/sign-in` form, marks the
welcome tour as seen in `localStorage` (`vg_welcome_seen_v1`), and saves the
browser state to `tests/e2e/.auth/admin.json`. Every spec starts from that
state. A spec that needs a clean, signed-out browser opts out:

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

If the saved session ever goes stale (e.g. `AUTH_SECRET` rotated), delete
`tests/e2e/.auth/` — the next run recreates it.

## Customer app specs

The customer app signs in with a WhatsApp code and has no test bypass.
`customer-app.spec.ts` uses the app's own access rules instead, writing its data
with Prisma straight to `DATABASE_URL` (`customer-app-data.ts`), so that variable
must point at the database the server uses:

- a CLIENT login with a bcrypt password (the email + password provider in
  `auth.ts` accepts any active user; `signInAction` sends a CLIENT to `/portal`);
- a `CustomerLink` (method `STAFF`, how the team grants access) from that login to
  a new Contact with a CONFIRMED booking, one issued invoice with a balance and
  one DRAFT invoice;
- a second CLIENT with an ACTIVE `BookingCollaborator` row, role VIEWER.

Each customer signs in through `/sign-in` in its own phone-sized browser
context (`asCustomer`). Everything is named `E2E … <stamp>` and deleted in
`afterAll`; the Business contact and cancellation-policy rows the settings tests
change are snapshotted and put back. `whenInteractive(locator)` waits until React
has hydrated an element, because a click that lands before hydration is lost.

`customer-browse.spec.ts` writes nothing at all. It runs signed out (browsing
halls is public) at 390px, and only reads: `publishedHalls()` in the same file
gives it the active, top-level venues the feed lists plus whether each may
carry a rating, so it can assert "a card for every published hall" rather than
a seeded number. It needs the same `DATABASE_URL`. Everything else is derived
from the screen — the searched date from the calendar it was picked on, the
capacity band from the chip's own URL.

Reading rather than writing is also the safe side of the feed's cache: the list
of halls is cached for 60s (`unstable_cache`, tag `guest-hall-feed`), so a spec
that adds or removes a hall cannot expect the feed to show that straight away.
A date's availability and prices are read per request and are always live.

Two selector anchors are worth knowing before you change the components: the
search sheet is `role="dialog"` named **Find a hall**, with its days in a
`role="group"` named `Days in <month>`; and a month grid marks itself
`aria-busy` until live availability lands, which the spec waits for, so a day
it picks is genuinely offerable and a day it reads as free genuinely is.

## Adding a test

1. Create `tests/e2e/<area>.spec.ts`. Import from `./helpers` rather than
   re-implementing login, naming, or Radix interactions.
2. Name everything you create with `uniqueName("Thing")` → `E2E Thing 1694…`.
   Unique per run, greppable, and safe to purge in bulk.
3. Prefer one `test()` per user journey with `test.step()` blocks. A step
   failure shows exactly where the journey broke and leaves one obvious
   `E2E …` record rather than a chain of skipped tests.
4. Clean up through the UI when a delete exists; otherwise leave the record
   (it carries the prefix) and say so with `test.info().annotations`.
5. Mark long journeys `test.slow()` — a `next dev` server compiling routes on
   first hit can take a while.
6. Keep specs independent of each other and of run order; `workers` is 1 by
   default but files may still run in any order.

## Selector conventions

Prefer, in this order:

1. **Role + name** — `getByRole("button", { name: "Create Lead" })`,
   `getByRole("heading", { level: 1, name: "Leads" })`.
2. **Label** — `getByLabel(/^Title/)` works on react-hook-form pages
   (`FormLabel` carries `htmlFor`), e.g. `/leads/new`, `/contacts/new`, sign-in.
3. **`fieldByLabel` / `inputByLabel`** — most dialogs (BD "New Lead",
   "New reimbursement claim", "Add employee", the quotation calculator) render
   a bare shadcn `<Label>` with no `htmlFor`, so `getByLabel` finds nothing.
   These helpers go label → parent wrapper → control. Labels are matched
   anchored and case-insensitively, ignoring the trailing ` *` required mark.
4. **Placeholder** — for search boxes (`getByPlaceholder(/Search name, email/)`).
5. **Text** — for toasts (`expectToast(page, "Lead created")`) and status
   badges; scope to a row first (`getByRole("row").filter({ hasText })`).

Avoid CSS class selectors; Tailwind classes change with every visual pass.

Component gotchas:

- **Radix Select** — trigger is `role="combobox"`, the popover `role="listbox"`,
  items `role="option"`. Use `selectRadixOption(root, "Category", "Travel")`
  or `selectRadixOptionOn(triggerLocator, "Contacted")`.
- **cmdk combobox** (lead → Contact) — items are `role="option"` inside a
  popover with a `Search contacts...` placeholder.
- **Radix AlertDialog** — `getByRole("alertdialog")`; Dialog — `getByRole("dialog")`.
  Filter by title text when more than one can be mounted.
- **Toasts** are sonner: `[data-sonner-toast]`, auto-dismiss in a few seconds,
  so assert right after the action.
- **Welcome tour** — gated by `localStorage`; global setup pre-dismisses it.
  `dismissTour(page)` exists for fresh contexts (auth specs).
- **Leads list scope** — defaults to "My leads"; auto-assignment may route a
  new lead elsewhere, so search with `/leads?scope=all`.
- **Reimbursements precondition** — filing a claim requires the signed-in
  user to be linked to an `Employee`. The spec self-heals by creating an
  employee whose work email is the admin login (hr:admin auto-links), and
  `/people` seeds legal entities on first run via "Set up organisation".

## CI

`.github/workflows/e2e.yml` runs on pull requests and on demand: Postgres 16
service → `prisma db push` → seed → `next build` → chromium install →
`E2E_USE_WEBSERVER=1 playwright test`. The HTML report and traces are
uploaded as an artifact when the job fails.
