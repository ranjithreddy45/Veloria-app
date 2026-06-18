# DigiMark Agency — Web & Mobile Application Blueprint
### Modeled on the proven "Veloria Grand" platform architecture

**Document type:** Product & engineering blueprint (modules, features, automations, UI/UX, data model, integrations)
**Source of truth:** Reverse-engineered from the live Veloria Grand codebase (Next.js 16 + React 19 + Prisma/PostgreSQL, 244 data models, 152 server-action modules, ~57 dashboard routes, 5 public/portal surfaces, native iOS + Android apps, 19 scheduled automations, 7 automation engines).
**Purpose:** Give DigiMark Agency a complete, no-gaps specification of every module, feature, automation, and UI/UX pattern required — using Veloria's battle-tested blueprint and translating it for a **digital-marketing agency**.

> **How to read this document**
> - **Part I–II** describe the *platform foundation* and *technology* every module sits on.
> - **Part III** is the **complete module catalog** — for each module: purpose, screens, exhaustive feature list, data entities, lifecycle/state machines, automations, RBAC, UI/UX, and integrations.
> - **Part IV–VII** cover the *automation registry*, *cross-cutting engineering patterns*, the *UI/UX & design system*, and *security*.
> - **Part VIII** is the **DigiMark translation map** — exactly what to keep, adapt, drop, or add to turn this into a digital-marketing-agency product, plus a phased build roadmap.

---

## Table of Contents

1. **Part I — Executive Summary & Build Philosophy**
2. **Part II — Technology Architecture & Stack**
3. **Part III — Complete Module Catalog**
   - 3.0 Platform Foundation (cross-cutting)
   - 3.1 Dashboard & My Work
   - 3.2 Sales CRM (Lead → Proposal → Contract)
   - 3.3 BD / Acquisition CRM (Partner/Vendor sourcing)
   - 3.4 Engagement & Omnichannel Communications
   - 3.5 Bookings & Event Operations → *Campaign & Delivery Operations*
   - 3.6 Projects / Delivery (CapEx pipeline → *Client Delivery pipeline*)
   - 3.7 Operations, Supply Chain & Service
   - 3.8 Finance, Accounting & Billing
   - 3.9 HR / People Platform & Recruitment (ATS)
   - 3.10 Performance / Gamification (Velos) & KRA Scorecards
   - 3.11 Marketing Growth Engine
   - 3.12 Analytics, Reporting, Forecasting & AI
   - 3.13 Public & Portal Surfaces
   - 3.14 Catalog (Packages / Menu / Pricing → *Service Catalog*)
4. **Part IV — Automation & Background-Job Registry**
5. **Part V — Cross-Cutting Engineering Patterns**
6. **Part VI — UI/UX & Design System Specification**
7. **Part VII — Security, Compliance & RBAC**
8. **Part VIII — DigiMark Translation Map & Build Roadmap**

---

# Part I — Executive Summary & Build Philosophy

Veloria Grand is a **single, unified business-operating system** for an event/venue/hospitality company. It is not a collection of apps — it is one platform where a lead captured from a webform flows through scoring, nurture cadences, quotation, contract, booking, event delivery, invoicing, double-entry accounting, vendor payouts, staff performance scoring, and post-event reviews, with every step automated, audited, permission-gated, and visible on web + mobile.

**The blueprint DigiMark inherits:**

| Principle | How Veloria implements it | Why it matters for DigiMark |
|---|---|---|
| **One identity, many modules** | A single `User` model is extended (never forked) by HR `Employee`, vendor, client, and portal roles. | One login, one permission system, one org chart across sales, delivery, finance, HR. |
| **Server actions over REST** | 152 typed `"use server"` action modules with Zod validation and a uniform `{success,data}|{success,error}` envelope. | Fast to build, type-safe end-to-end, no separate API layer to maintain. |
| **Everything is a state machine** | Leads, deals, quotations, contracts, bookings, projects, invoices, payouts, tickets, candidates — each has an explicit status lifecycle with server-enforced transition guards. | Predictable workflows; illegal transitions are impossible, not just discouraged. |
| **Automate the follow-up, not just the record** | 7 engines (workflow, cadence, blueprint, escalation, reminder, approval, scoring) + 19 scheduled jobs do the chasing, escalating, scoring, and reminding. | An agency lives or dies on follow-through; the system never forgets. |
| **Maker-checker + audit everywhere** | Segregation-of-duties on quotes, contracts, payouts, journals, PRs; append-only `ActivityLog`; `SUPER_ADMIN` controlled bypass. | Financial control and accountability without slowing people down. |
| **Permission-first UI** | Navigation, routes, and every action are gated by a `resource:action` permission system; the sidebar only shows what you may use. | 19 roles see 19 tailored apps from one codebase. |
| **Colorful-but-premium, mobile-native** | A token-based design system (OKLCH colors, StatTiles, progress rings, kanban, steppers) shipped as web + Capacitor iOS/Android with biometric login and push. | A modern product your team actually wants to open. |

DigiMark keeps **~85%** of Veloria's modules unchanged in shape (CRM, comms, finance, HR, performance, ops, analytics, portals). The event-specific surfaces (venue bookings, BEO, kitchen, seating, RSVP) are **re-pointed** at the agency's real "delivery object": **client campaigns, retainers, and content projects** (detailed in Part VIII).

---

# Part II — Technology Architecture & Stack

| Layer | Technology (from Veloria) | Notes for DigiMark |
|---|---|---|
| **Framework** | Next.js 16 (App Router, RSC, Server Actions), React 19, TypeScript 5 | Keep. Route groups: `(auth)`, `(dashboard)`, `(portal)`, `(vendor-portal)`, `(guest)`, `(public)`. |
| **Database** | PostgreSQL via Prisma 6 (244 models, 128 enums, 6,279-line schema) | Keep. Single schema, `entityId` discriminator for multi-entity/multi-brand. |
| **Auth** | NextAuth v5 (`@auth/prisma-adapter`) — email/password (bcrypt), Google OAuth, passwordless WhatsApp OTP, JWT sessions re-validated against DB every 5 min | Keep. Add SSO (Google Workspace) for agency staff. |
| **Mobile** | Capacitor 8 — native iOS + Android wrappers, biometric (Face/Touch ID), push + local notifications, camera, haptics, share, splash, status bar, safe-area insets | Keep. App id/name configurable. |
| **Payments** | Razorpay (orders, HMAC-verified webhooks, payment links, refunds, idempotent capture) | Keep + add subscription/recurring billing for retainers. |
| **Email** | Resend (transactional + tracked sends, open/click pixels, HMAC-signed redirect guard) | Keep. |
| **Messaging** | WhatsApp Business Cloud API (templates, inbound webhook, delivery callbacks); SMS via MSG91/Twilio; cloud telephony via Exotel/Knowlarity/MyOperator (click-to-call) | Keep. |
| **AI** | Multi-provider with fallback chain: **OpenAI → Groq (Llama 3.3 70B) → Gemini 2.5 Flash**; default `gpt-4o-mini`. Conversational CRM agent (SSE streaming + tool-calling), email drafting, lead/deal scoring, sentiment, anomaly detection, forecasting | Keep + add content generation, ad-copy, SEO assist. |
| **State/UI** | Tailwind v4 (OKLCH tokens), shadcn/ui + Radix primitives (~40 components), Recharts, dnd-kit (drag-drop), TanStack Table/Query, react-hook-form + Zod, Sonner toasts, next-themes (dark mode), next-intl (en/hi/kn/te) | Keep. |
| **Infra** | Vercel (Hobby-tier-friendly: single daily cron fans out to 19 jobs; upgrade to per-job schedules on Pro), security headers (HSTS, CSP-ish, X-Frame-Options), in-memory rate limiting | Keep; move time-sensitive crons to a 1–5 min pinger or Pro crons. |
| **Validation/security** | Zod everywhere, AES-GCM encryption at rest for statutory IDs, timing-safe cron-secret compare, IDOR guards, honeypot + rate-limited public endpoints | Keep. |

**Repository layout (mirror this):**
```
src/
  actions/      152 *.actions.ts  (server actions = features)
  app/          route groups (auth, dashboard, portal, vendor-portal, guest, public, api)
  components/   ui/ shared/ layout/ ai/ comms/ widget/
  config/       navigation.ts, features.ts, site.ts
  lib/          rbac, permissions, notify, the 7 engines, ai/, finance/, hr/, acq/, projects/, velos/, kra/
  schemas/      69 Zod *.schema.ts
prisma/         schema.prisma, migrations, seed, bootstrap
android/ ios/   Capacitor native projects
messages/       i18n locale JSON
```

---

# Part III — Complete Module Catalog

> Every module below lists: **Purpose · Screens/Pages · Exhaustive Features · Data Entities · Lifecycle · Automations · RBAC · UI/UX · Integrations.** Nothing omitted.

## 3.0 Platform Foundation (cross-cutting — every module depends on this)

**Purpose:** The shared spine: identity, permissions, settings, notifications, search, audit, mobile shell, design system.

**Sub-systems & features:**

- **Identity & Auth** — email/password (bcrypt), Google OAuth (auto-verifies, defaults to CLIENT role), passwordless **WhatsApp OTP** login (6-digit, TTL, max-5-attempts, single-use, phone-normalized). JWT sessions with **permissions baked in at sign-in and re-validated against the DB every 5 minutes** (deactivated users force-logged-out; role changes apply live). Password reset tokens. Sign-up/in/forgot/reset flows.
- **RBAC (dual system)** —
  1. **Global permission system** (`src/lib/permissions.ts`): ~250 `resource:action` permission strings, a static `ROLE_PERMISSIONS` matrix for **19 roles**, plus DB overrides (`RolePermission`) editable in-app for 14 non-admin roles. Enforced in **three layers**: middleware route-prefix gating (longest-prefix wins), edge `authorized()` callback, and `hasPermission()` inside every server action. `SUPER_ADMIN`/`ADMIN` get `["*"]`.
  2. **Capability matrix** (BD module, `acqCan`): a separate code-managed capability model for the acquisition CRM.
- **Multi-venue / multi-entity** — venue/entity hierarchy (parent/child), groups, cross-entity coordinated scheduling. `entityId` discriminator on records (default single-tenant `"BILLION"`).
- **Settings hub** (24 config screens) — Venues, Pipeline stages, Contract templates, Users, **Roles & Permissions matrix editor**, Email templates, **Workflows** (no-code), **Blueprints** (state-machine), Integrations (currency, Google Calendar, lead-capture, social, Tally, telephony, WhatsApp), Lead Capture, Telephony, Emergency, Notifications, Activity Log, Escalation Rules, Referral Rules, Assignment Rules, Macros, Scoring Rules, Approval Rules, Webforms, SOP templates, Commissions, Trash.
- **Notifications** — in-app inbox (unread counts, mark-read/all, delete), 22 notification types, per-user email/SMS preferences (8 event types), push device-token registration, fire-and-forget `notify`/`notifyAdmins` helpers.
- **Global search & Command Palette** — ⌘K/Ctrl+K palette: recents, quick actions, "jump to" nav, live cross-entity search.
- **Saved Views** — per-entity saved filters/sort/columns, default/shared/system flags.
- **Trash & soft-delete** — soft-delete + restore + scheduled purge across all major entities.
- **Activity Log / audit** — append-only `ActivityLog` on virtually every mutation; viewable in settings.
- **API Keys** — generate/list/revoke (hashed, 8-char prefix, last-used tracking) for external integrations.
- **Rate limiting** — in-memory limiter on public endpoints.
- **Documents** — central document store: CRUD, by-entity attachment, acknowledgement tracking.
- **Gallery** — media library: CRUD, by-entity, public/portal feeds.
- **i18n** — 4 locales via next-intl, cookie-driven, locale switcher.
- **Mobile shell** — Capacitor app: biometric unlock, push/local notifications, camera/gallery pickers, haptics, share, platform detection, safe-area layout, bottom-nav, splash + dark status bar.

**Key entities:** `User`, `Account`, `Session`, `OtpCode`, `PasswordResetToken`, `RolePermission`, `ApiKey`, `DeviceToken`, `Notification`, `ActivityLog`, `SavedView`, `Document`, `GalleryItem`, `Venue`, plus the automation-config entities (`Workflow`, `Blueprint`, `AssignmentRule`, `EscalationRule`, `Macro`, `ScoringRuleSet`/`ScoringRule`, `ApprovalRule`, `Webform`, `EmergencyProtocol`, `TelephonyConfig`, `EmailTemplate`, `AutoWelcomeConfig`, `LeadCaptureConfig`).

**RBAC roles (19):** `SUPER_ADMIN, ADMIN, SALES_EXEC, SALES_HEAD, EVENT_COORDINATOR, FINANCE, STAFF, VENDOR, CLIENT, BD_EXECUTIVE, BD_HEAD, OPERATIONS, LEGAL, PROJECTS_EXEC, PROJECTS_HEAD, HR_MANAGER, HR_EXECUTIVE, AUDITOR` (+ portal/vendor sub-roles). *(DigiMark renames a handful — see Part VIII.)*

---

## 3.1 Dashboard & My Work

**Purpose:** The landing surface and the personal task cockpit.

- **Dashboard** — role-aware KPI tiles (revenue, bookings/projects, leads, conversion), trend charts, and quick links. Powered by `getDashboardStats`.
- **My Work / Workqueue** — a personal feed: open tasks (sorted by due-date then priority), plus computed counts {open, overdue, due-today, my-leads, my-bookings}; overdue-highlighted table; StatTiles.

**UI/UX:** StatTile grid (colored accents, deltas, progress rings), Recharts trend lines, overdue highlighting. **RBAC:** `dashboard:read`, `dashboard:analytics`.

---

## 3.2 Sales CRM (Lead → Proposal → Contract)

**Purpose:** The customer-facing revenue pipeline from first enquiry to signed contract.

**Screens:** Contacts (list/new/detail-360/edit), Leads (list + KPI strip / new / detail / edit / **follow-ups queue**), Web Inquiries triage, **Pipeline kanban**, Quotations (list / calculator wizard / detail), Contracts (list/new/detail/edit), Approvals queue.

**Exhaustive features:**
- **Contacts** — CRUD, soft-delete/restore/purge, **duplicate detection** (email/phone), tags, types (Individual/Corporate), FK-guarded delete, **Customer-360 timeline** (leads + bookings + invoices + communications), VIP/anniversary/lifetime-value fields.
- **Leads** — CRUD + soft-delete; **auto-assignment** on create (round-robin/direct via rules); **lead scoring** (see below) recomputed on every change; **speed-to-lead 15-min SLA** stamp + escalation; default next-business-day follow-up; owner-required-to-Win guard; `estimatedValue` derivation; follow-up queue bucketed Overdue/Today/Upcoming (managers see all); KPI aggregates.
- **Lead capture** — external intake from Facebook/Google/IndiaMART/JustDial/generic webhooks → find/create contact → derive value → auto-assign → **auto-welcome** WhatsApp (immediate or delayed task) → enroll into matching nurture cadences.
- **Pipeline** — drag-drop kanban; `moveDeal` maps stage↔lead-status, stamps won/lost dates, triggers approval on Won, awards gamification points; configurable stages (probability, won/lost system stages protected); **weighted forecast** = Σ(value × probability); convert deal → booking/project (with availability guard).
- **Quotations** — calculator wizard with snapshot inputs/outputs; lifecycle **DRAFT → PENDING_APPROVAL → APPROVED → SENT** (+REJECTED); monotonic numbering (`VG-Q-NNNNN`) in a serializable transaction; **segregation-of-duties** (can't approve own quote); freezes output snapshot + PDF on approve; send via Email/WhatsApp/Manual; versioning; transition audit trail.
- **Contracts** — template-driven with `{{variable}}` interpolation; DRAFT-only edit; send (→ email + e-sign request); portal view auto-marks VIEWED; e-signature (signature-pad or e-sign adapter); mark-signed; template CRUD with auto-variable detection; **signing reminders** cron.
- **Approvals (maker-checker)** — generic approval engine: rule CRUD with **approver chains**, condition evaluation (equals/contains/in/gt/lt…), submit → advance chain → approve/reject/delegate/cancel, segregation-of-duties, history.
- **Assignment routing** — priority-ordered rules, DIRECT or ROUND_ROBIN.
- **Lead scoring** — three layers: hardcoded factor model (0–100), configurable rule-sets (field/activity/profile/decay categories), and **AI score** (`aiScore`/reason/factors) refreshed by cron.
- **Macros** — one-click multi-action (update status/field, create task, log communication).
- **Bulk ops** — update/delete/assign/enroll-cadence/change-status across leads & contacts.
- **Sales signals** — 72-hour unified activity feed (leads/deals/payments/bookings/comms/tasks) + daily KPI summary.

**Lifecycles:** Lead `NEW→CONTACTED→QUALIFIED→PROPOSAL_SENT→NEGOTIATION→WON/LOST`; Quotation `DRAFT→PENDING_APPROVAL→APPROVED→SENT`; Contract `DRAFT→SENT→VIEWED→SIGNED` (+EXPIRED/CANCELLED).

**Handoff chain (fully wired, prefilled buttons):** Lead → Create Quotation → Block Slot/Convert → Booking → Create Contract + Create Invoice.

**RBAC:** `contacts:*`, `leads:*`, `pipeline:*`, `quotes:*`, `contracts:*`. SALES_EXEC creates but cannot approve quotes; SALES_HEAD approves; SUPER_ADMIN bypasses gates.

**UI/UX:** client-paginated tables with separate DB-aggregate KPIs, drag-drop kanban, 2/3+1/3 detail pages with score-breakdown + AI cards + smart suggestions, calculator wizard, contextual page-help.

**Integrations:** e-sign adapter, Resend, WhatsApp, lead-capture webhooks, cadence enrollment.

---

## 3.3 BD / Acquisition CRM (Partner / Supplier sourcing)

**Purpose:** A *second, separate* CRM for sourcing and signing **supply-side partners** (in Veloria: venue/hall owners; in DigiMark: **media vendors, freelancers, influencers, tech partners, white-label suppliers**). Deliberately namespaced and isolated from the Sales CRM.

**Screens:** BD Dashboard (funnel + SLA + loss reasons), Lead Inbox, Follow-ups, **Deal Board** (kanban), Contracts (CLM), Properties/Partners, Hall Owners/Partners directory, Competitors intelligence.

**Exhaustive features:**
- **BD Leads** — create with E.164 dedup, working-hours first-contact SLA, contact logging (channel/outcome/note → activity timeline), **multi-point qualification gate**, disqualify-window rules (blocked until N attempts + time window).
- **BD Deals** — a **guarded 10-stage state machine** (`QUALIFIED→EVALUATION→EVALUATION_COMPLETED→PROPOSAL_SENT→NEGOTIATION→CONTRACT_SENT→SIGNED→WON`, +LOST/ON_HOLD) where each transition has **entry guards** (evaluation passed + N photos/assets; commercials set per model; signatory verified; below-floor deals require head approval; large deals require sign-off). Evaluation scorecard (weighted 0–100, gate thresholds); attachments; economics **freeze/unfreeze**; change-logs; re-engagement timers on loss.
- **Projections / financial modelling** — multi-year revenue model (DRAFT→PENDING_APPROVAL→APPROVED→SENT), maker-checker, frozen snapshot + PDF, versioning.
- **Contracts (CLM)** — inherits commercials from the won deal; sequential numbering; **version snapshots + restore**; **dual-axis lifecycle** (phase: Authoring/Approval/Negotiation/Execution/Post-Execution × status: Draft/Approved/Negotiated/Signed/Active/Terminated); send (email/WhatsApp), e-sign, mark-signed (evidence required), activate/terminate.
- **Properties/Partners onboarding** — auto-created on Won with seed onboarding tasks + an onboarding **project** (the bridge into the Projects/Delivery pipeline); assign manager; **availability gate** that publishes the partner/inventory to the Sales side (idempotent **bridge** that creates the bookable/usable record exactly once, double-guarded against races).
- **Competitors** — comparison/SWOT, list, form.

**RBAC (dual):** global `owners:read`/`competitors:read` for routes+nav; **`acqCan` capability matrix** (lead:write, deal:transition, bdhead:approve, legal:review, onboarding:complete, property:available, inventory:view) governs actions. BD_EXECUTIVE acts; BD_HEAD approves/signs-off; LEGAL reviews; OPERATIONS completes onboarding.

**Automations:** `acq-sla` cron (first-contact breach, follow-up due, onboarding SLA, re-engagement); contract-signing reminders; WON → notify Ops; available → notify Sales.

**UI/UX:** force-dynamic dashboard with cumulative funnel, deal kanban, tabbed deal detail (with projection tab), `en-IN` formatting.

---

## 3.4 Engagement & Omnichannel Communications

**Purpose:** Every 1:1 and bulk touch with a contact across email, WhatsApp, SMS, and calls — plus automated multi-step sequences.

**Screens:** Unified **Inbox** (channel-filtered), **Cadences** (sequence builder + enrollments), Sales Signals, Email Insights (tracking dashboard), WhatsApp inbox (conversation list + chat view + stats), SMS console, Call Log (+ analytics), Campaigns, Email Templates (settings).

**Exhaustive features:**
- **Cadences/sequences** — multi-step over Lead or Contact; step types **Send Email / WhatsApp / SMS / Create Task / Wait / Log Note**; per-step delays (days/hours); lifecycle DRAFT→ACTIVE→PAUSED→ARCHIVED; single + bulk enrollment (dedup), pause/resume/stop, drag-reorder; **exit criteria** (status change, reply received — auto-exits on inbound reply); auto-enroll hooks on lead intake.
- **Unified inbox** — single chronological feed merging Communications, Calls, WhatsApp, SMS, and email-tracking events into one normalized timeline with channel chips.
- **WhatsApp** — free-text + template sends, bulk by template, per-contact conversation threads, delivery/read stats, inbound webhook (HMAC-verified, captures unknown numbers as leads), SMS fallback on failure.
- **SMS** — provider-agnostic (MSG91/Twilio), send to contact or raw number, stats, every attempt persisted.
- **Calls/telephony** — manual call logging (disposition, duration, recording, tags, follow-up → auto-task); **click-to-call** via provider; call analytics (by disposition/direction/hour); webhook updates.
- **Email** — Resend sends on logged emails + cadence steps with **open/click tracking** (1×1 pixel + signed redirect); reusable templates (HTML/subject/category); 5 hard-coded transactional templates (booking confirmation, quote sent, invoice sent, payment received, contract sent); tracking dashboards (overall/contact/campaign, top-engaged contacts).
- **Reminders engine** — staged guest/event reminders (Save-the-Date −30d, Excitement −7d, Final Countdown −3d, Tomorrow −1d, Day-of) with per-record template overrides, preview/merge-fields, retry-failed, skip; WhatsApp with SMS fallback.
- **Campaigns** — bulk multichannel blasts (Email/WhatsApp/SMS) with JSON recipient segmentation; DRAFT→SCHEDULED→SENDING→SENT/CANCELLED; per-campaign stats. *(Note: in current Veloria the bulk-send path is partially mocked — DigiMark should wire real delivery.)*

**Lifecycles:** Cadence enrollment `ACTIVE/PAUSED/COMPLETED/STOPPED/EXITED`; message statuses per channel (Queued/Sent/Delivered/Read/Failed).

**Automations:** `cadence-executor` (due steps), `fast` (cadence + exits + SLA escalation), exit-checker (on inbound reply), `guest-reminders`. **RBAC:** `communications:*`, `whatsapp:*`, `sms:*`, `campaigns:*`, `email-templates:*`, `reminders:manage`.

**UI/UX:** merged inbox feed, step-list sequence builder with per-type config dialogs, WhatsApp-style chat, template editor, merge-field substitution (`{guestName}`, `{eventName}`…).

**Integrations:** Resend, WhatsApp Cloud API, MSG91/Twilio, Exotel/Knowlarity/MyOperator, self-hosted tracking pixels.

> **Gaps to close for DigiMark:** add **unsubscribe/opt-out/consent** (no suppression list exists today), wire real campaign delivery, and add a merge-field engine to email templates.

---

## 3.5 Bookings & Event Operations → *Campaign & Delivery Operations*

**Purpose (Veloria):** the core event lifecycle — slot → HOLD/CONFIRM booking → BEO/kitchen/seating/guests → run sheet → post-event. **For DigiMark this entire module re-points** to *campaign scheduling, content calendars, and engagement/launch operations* (see Part VIII). The underlying mechanics are identical and worth keeping.

**Screens:** Bookings list, **Calendar** (month grid + day panel + multi-venue selector), Booking detail with tabs (menu, seating, guests, tasting, day-of, control, operations, execution), **Availability board** (venue × slot grid + occupancy heatmap), Blackouts manager, BEO dashboard + sheet, Kitchen board + plan, RSVP (public).

**Exhaustive features:**
- **Booking lifecycle** — `placeHold` (48h default, sets `holdExpiresAt`), `releaseHold`, create/update/cancel with terminal-state guards; **conflict detection** keyed `@@unique(venueId, date, timeSlot)` over a UTC-day range (full-day vs partial-slot conflicts + blackout dates); inline commercials.
- **Handoffs** — Quotation → slot block → Booking → **Invoice** (per-plate advance + 20/60/20 installment plan, race-guarded against double-invoice) → BEO/Kitchen (idempotent, one per booking).
- **Event-day run sheet** — timeline with seeded default items, add/update/remove/reorder, item status, staff assignment, timeline status PLANNED→LIVE→COMPLETED.
- **Seating** — grid chart (rows×cols), tables (capacity/shape), assign/move/remove guests (drag-drop).
- **Guests & RSVP** — guest list rollups, bulk import, check-in + stats, RSVP, dietary + plus-ones + categories; invitations via WhatsApp; **public tokenized RSVP** form (captures plus-ones/dietary, notifies owner).
- **BEO (function sheet)** — auto-numbered, sections (menu/floor-plan/AV/decor/staffing/special-instructions + run-of-show JSON), status transitions, incident log (severity).
- **Kitchen & F&B** — kitchen plan auto-linked to BEO, line items with est/actual cost → food-costing variance.
- **Tastings** — schedule/confirm/complete/cancel/no-show.
- **Menu & Packages** — menu item CRUD (category/cuisine/dietary/price-per-head); booking menu builder (price × guests); packages CRUD + duplicate + tiers + by-event-type.

**Lifecycle:** Booking `HOLD→TENTATIVE→CONFIRMED→IN_PROGRESS→COMPLETED/CANCELLED`; TimeSlot `MORNING/AFTERNOON/EVENING/FULL_DAY`.

**Automations:** `hold-expiry` (cancel expired holds → free slot), `event-triggers` (EVENT_TOMORROW pre-event + POST_EVENT NPS), `guest-reminders`. On create: fires `EVENT_CREATED`/`BOOKING_CONFIRMED` workflows, confirmation email, maker-checker approval.

**RBAC:** `bookings:*`, `beo:*`, `kitchen:*`, `menu:*`, `packages:*`, `guests:*`, `tastings:*`, `invitations:*`. **UI/UX:** calendar, availability grid/heatmap, drag-drop seating, run-sheet, sectioned BEO.

---

## 3.6 Projects / Delivery Pipeline (CapEx build-out → *Client Delivery*)

**Purpose (Veloria):** managing the **CapEx build-out of a new venue** from partner handoff to go-live, in 9 governed stages — plus a separate **day-of-event execution** sub-system. **For DigiMark** this is the **client onboarding + project/retainer delivery** engine.

**Two sub-systems:**

**(A) Project pipeline (9-stage, governed):**
- Stages: `HANDOFF → ASSESSMENT → CAPEX → EXECUTION → INTERNAL_QC → OPS_AUDIT → FINAL_GO_AHEAD → HANDOVER → LIVE`. **Phase stored as an additive-safe string** with legacy-value normalization (no destructive migrations).
- **Server-enforced stage gates** — e.g. Internal QC requires all readiness items + work packages done; Ops audit blocks on open critical/major snags; Final go-ahead is a Head-only approval; Handover needs dual (Ops + Mgmt) acknowledgement.
- **CapEx calculator** — categories (area/unit/lumpsum basis), contingency %, luxury-floor warnings, Gantt week estimator; versioned projections (DRAFT→APPROVAL→APPROVED→SENT) with frozen outputs.
- **Readiness panel** — seeded checklist vs standards; auto-severity tagging (life-safety/structural = critical).
- **Ops audit** — deep compliance checklist (statutory/fire/utilities), critical flags, PASS/FAIL/NA.
- **Snags punch-list** — CRITICAL/MAJOR/MINOR; lifecycle OPEN→IN_PROGRESS→FIXED_PENDING_VERIFICATION→VERIFIED_CLOSED→REOPENED; **verify is Ops-only and requires a fresh after-photo**; PMs can't self-downgrade severity.
- **Portfolio rollup** — per-project estimate vs committed, over-budget/overdue/at-risk flags.
- **Procurement (project)** — vendors, work packages (budget vs CapEx), purchase orders (DRAFT→ISSUED→RECEIVED→PAID), budget-variance board, GL bridge.
- **Rate card** — category rates (basis/rate/duration/floor).
- **Handover panel** — auto-compiled report + dual acknowledgement.

**(B) Execution sub-system (day-of delivery):** `ExecutionPlan` (one per booking) → `ExecutionPhase` → `ExecutionTask` with SLA start/finish, dependencies, proofs, checklists, time-logs, escalations — **generated from SOP templates** and gated by **Blueprints**. Feeds the Performance engine.

**Automations:** `project-escalation` (at-risk projects → leadership), `applySOPToBooking` (atomic plan/task generation), blueprint validation. **RBAC:** `projects:read/create/update/approve/audit`, `procurement:read/write`, `sop:*`, `execution:*`. PROJECTS_EXEC builds; PROJECTS_HEAD approves; OPERATIONS audits.

**UI/UX:** animated **9-node workflow stepper** (with reopen-to-stage), readiness/ops-audit accordions with Done/Pending/NA pills + % rings, snag board with severity hues + before/after photos, CapEx calculator with luxury-floor warnings, portfolio table, event-control dashboard.

---

## 3.7 Operations, Supply Chain & Service

**Purpose:** Internal work management, vendor/resource/inventory operations, customer support, and the no-code automation builders.

**Screens:** Tasks (board/list/templates), My Work, Event Operations (run-of-show on a booking), Vendors + Vendor Portal, Resources, Staff scheduling, Inventory, Rentals, Insurance, Procurement, Logistics/Dispatch, Support tickets, Emergency, Escalation Rules, Workflows, SOP templates.

**Exhaustive features:**
- **Tasks** — drag-drop kanban (TODO/IN_PROGRESS/IN_REVIEW/DONE via dnd-kit) + list toggle; subtasks; **checklist items**; **task templates** (bulk-apply to a booking/project); booking linkage; assignee/priority/due-date; on-done fires gamification (on-time check). Recurrence via workflow or SOP.
- **Vendors** — marketplace CRUD (13 categories, statuses, GSTIN, rating); assign to booking (dup-guarded); **bidding** (submit/accept/reject, one-winner auto-reject others); payouts.
- **Vendor Portal (external)** — self-service: dashboard (upcoming events, pending bids, paid payouts), my events, my bids, submit bids on open work, my payouts.
- **Resources** — CRUD (staff/equipment/vehicle/addon), allocate to booking (conflict-guarded), monthly calendar.
- **Inventory** — SKU catalog, reserve/release for bookings (stock-guarded), date-range availability, **low-stock alerts** (reorder level), filters.
- **Rentals** — rentable catalog (daily/weekly rates), rent → reservation (weekly-vs-daily cost calc), return, availability, cost calculator.
- **Insurance** — policy CRUD (liability/property/cancellation/weather), expiring-soon view, stats, mark-claimed.
- **Procurement** — purchase requisitions + line items (numbered), status machine PENDING→APPROVED→ORDERED→RECEIVED (+REJECTED), **maker-checker**, **GRN on receive posts GL accrual** atomically.
- **Logistics/Dispatch** — dispatch orders + items (optional inventory link), status PLANNED→DISPATCHED→DELIVERED→RETURNED (+CANCELLED), **auto stock-out on dispatch / restore on return**, partial returns, driver/vehicle.
- **Support/Helpdesk** — tickets (numbered) with internal/public messages, priority, category, contact/booking link, assignee, status machine (public reply on resolved auto-reopens), **priority-based first-response SLA**.
- **Emergency** — protocols (procedures, contacts) + incident report/resolve.
- **Escalation engine** — rules on (category, priority, delay-threshold, level L1/L2/L3, notify users/roles) tied to ExecutionTask SLA breaches.
- **Workflow automation (no-code)** — trigger (Event Created/Booking Confirmed/Payment Due/Event Tomorrow/Post Event/Lead Created) + ordered actions (Send Email/WhatsApp/Create Task/Notify/Update Status) with `{{token}}` interpolation, toggle active, manual run, logs, re-entrancy guard.
- **SOP templates** — phases + task definitions → instantiate execution plans.

**Automations:** `support-sla`, `escalation-check`, workflow executor. **RBAC:** `tasks:*`, `vendors:*`, `resources:*`, `inventory:*`, `rentals:*`, `insurance:*`, `procurement:read/write`, `support:read/write`, `logistics:read/write`, `emergency:*`, `escalations:*`, `workflows:*`, `vendor-portal:*`.

**UI/UX:** dnd-kit kanban, queue inbox with StatTiles, per-module board/list/detail trios, calendar scheduling, **rules-builder UIs** (escalation + workflow with dynamic action rows).

---

## 3.8 Finance, Accounting & Billing

**Purpose:** A real **double-entry general ledger** with sub-ledgers, statutory tax/payroll, and a payments-backed AR/AP pipeline. The most complex domain — keep it intact.

**Screens:** General Ledger (grid + trial balance + manual journal), **Command Center** (owner cockpit), Bank & Reconcile, Reports (P&L/BS), Tax & Compliance (GSTR), Cash Flow (13-week), Budgets, Anomalies, Payroll, Fixed Assets, E-Invoice, Revenue; Invoices (+PDF), Payments, Payouts, Commissions.

**Exhaustive features:**
- **Chart of accounts** — Indian-GAAP CoA (assets/liability/equity/income/expense), control accounts, tax defaults; seeded; logical-name → code map for bridges.
- **Double-entry posting engine** — single poster with `validateBalanced` (≥2 lines, debit XOR credit, Σdr=Σcr in **integer paise**), gapless journal numbering per FY, period-open guard, **reverse-entry** (cross-linked). A **DB constraint trigger** rejects any unbalanced POSTED entry at the database layer.
- **AR bridge** — invoice issued (Dr AR / Cr Revenue / Cr GST, nets advances); payment received (Dr Bank / Cr AR or Customer Advances). Idempotent on source ref.
- **AP bridge** — payout paid (Dr payable / Cr Bank); duplicate-payout detection.
- **Bank reconciliation** — CSV import (tolerant parsing, dedupe key, idempotent re-import), match scoring/suggestions, learned recon rules, categorize → posts BANK journal + marks reconciled atomically.
- **GST/tax** — CGST/SGST (intra) vs IGST (inter-state) split by place-of-supply; TDS sections + thresholds; derived GSTR-3B/GSTR-1/TDS (read-only).
- **E-invoicing** — swappable IRP adapter (mock/sandbox IRN + signed QR), status lifecycle.
- **Budgets vs actuals** — plan lines vs posted actuals per FY, variance.
- **Cash-flow forecast** — 13-week rolling (bank balance + open invoices by due-date − expense run-rate), runway index, stress toggle.
- **Fixed-asset depreciation** — straight-line monthly charge (Dr depreciation / Cr accumulated), one charge per asset/period; per-venue/event P&L tagging.
- **Payroll runs** — employees, slip computation (PF/ESI/PT/TDS), draft run → post balanced salary journal.
- **Commissions** — rules + entries (% of invoice + flat), approve → pay lifecycle.
- **Anomaly flags** — duplicate payment / round-amount / weekend-large, review queue.
- **Invoices** — create/update/send/delete, installment plans, stats, PDF; single money-math source.
- **Payments** — record, verify proof, Razorpay order/verify/webhook (HMAC), payment links, **exactly-once idempotent capture** (status-guarded updateMany + relative increment), auto-confirm booking on capture.
- **Payouts** — vendor/owner/commission payouts; PENDING→APPROVED→PAID (GL posts at PAID); **maker can't approve own** (SUPER_ADMIN bypass).
- **Currency & pricing** — multi-currency rates + conversion; pricing rules/rate plans + `calculatePrice`.

**Entities:** `FinAccount`, `FinPeriod`, `FinJournalEntry`/`FinJournalLine`, `FinSequence`, `FinBankAccount`/`FinBankTxn`/`FinReconRule`, `FinBudget`/`Line`, `FinAsset`/`FinDepreciationEntry`, `FinEmployee`/`FinPayrollRun`/`FinPayslip`, `FinAnomaly`, `FinEInvoice`; `Invoice`/`Installment`, `Payment`, `Payout`, `CommissionRule`/`Entry`, `Currency`.

**Automations:** `invoice-due` (mark overdue + payment-due workflows), `anomaly-detection`; department→GL bridges (best-effort, never block host flow). **RBAC:** write = SUPER_ADMIN/ADMIN/FINANCE; AUDITOR read-only; period-close/seed admin-only. **Integrations:** Razorpay, Tally sync, e-invoice IRP, currency.

> **For DigiMark:** add **recurring/retainer billing** (subscriptions), **media-spend pass-through** with markup, and **per-client/per-project profitability** (gross margin = revenue − COGS/media/freelancer cost − allocated hours).

---

## 3.9 HR / People Platform & Recruitment (ATS)

**Purpose:** A full HR platform built **on the same `User` identity** (Employee extends User, never forks) + an applicant-tracking system. Agencies are people-businesses — this is first-class.

**Screens:** People (Directory, Org Chart, Joining & Exits, Documents), Time & Attendance (Attendance + sites + regularizations, Leave + approvals + calendar, Shifts, Timesheets), Performance (Reviews, OKRs, Engagement, LMS), HR Admin (Analytics, Help Desk, Change Requests, Compensation, Settings); Recruitment (Overview, Jobs, Candidates, Applications); public Careers microsite + token onboarding portal.

**Exhaustive features:**
- **Employee core/directory** — CRUD with FK validation + dup-email guard, auto employee codes, soft-delete (→ EXITED, un-strands approvals), filter/paginate, KPI stats, dual dimensions (legal entity + business vertical), department/designation, self-relation manager, custom fields (JSON + definitions), **bulk CSV import** with preview+commit.
- **Org chart** — self-relation tree; drives approval routing.
- **Onboarding/offboarding journeys** — templated task lists, day-1 blocking gate, status transitions toggling linked-User access, exit interviews, **token pre-joining portal** (single-use claim).
- **Attendance** — geo check-in/out (Haversine radius + IP allow-list), WFH fallback, selfie, auto half-day (<4h), **regularization** request→approve; UTC-day keyed.
- **Leave** — types/holidays, per-year balances (auto-seeded accrual), apply with working-day calc + overlap guard + balance reservation, approve/reject/cancel, team calendar.
- **Shifts** — shift types, single/range roster, weekly grid, swap request→decide (clash-guarded).
- **Performance (HR)** — appraisal cycles, goals/KRAs (weighted, self+manager ratings), Self/Manager/Peer reviews, manager queue, HR calibration grid.
- **Helpdesk** — categories with SLA hours, tickets (auto SLA due, numbered), threaded comments (agent internal notes), KB articles.
- **Change requests** — self-editable fields → HR approve → apply diff.
- **Document vault** — org vs employee scope, acknowledgements + coverage, expiry, mail-merge templates, e-sign adapter.
- **Statutory/compliance** — PAN/Aadhaar/bank **AES-GCM encrypted at rest**, masked vs reveal (every view audit-logged), India-format validation, UAN/ESI/PF/PT.
- **Analytics** — headcount, attrition, by entity/vertical/dept, attendance %, leave-by-type, appraisal completion.
- **ATS** — job openings (lifecycle + filled stamp), candidate pipeline stages, applications (unique per candidate+job), interviews (round/mode/rating/feedback), offers (CTC), dashboard with **time-to-fill/time-to-hire** + pipeline matrix; **hire → onboard** auto-conversion (creates Employee, starts onboarding); **public careers** list/detail/apply (capped untrusted input).

**RBAC:** `hr:read/write/admin/approve/statutory`, `recruit:read/write`. HR_MANAGER full; HR_EXECUTIVE no admin/statutory; AUDITOR read-only; managers approve by org-chart match. **Automations:** journey task spawning, leave accrual, attendance classification, hire→onboard chaining; full audit. **UI/UX:** directory cards with status hues, org tree, attendance calendar + check-in widget, leave balances, shift roster grid, ATS pipeline matrix, candidate tabs, public careers microsite.

> **For DigiMark, make real (Veloria has these as placeholders):** **Timesheets / billable-hour tracking & utilization** (critical for agency profitability), **OKRs**, **Engagement**, **LMS**, **Compensation**.

---

## 3.10 Performance / Gamification (Velos) & KRA Scorecards

**Purpose:** Motivate and measure the team — a points-based gamification layer plus formal monthly scorecards.

**Screens:** Performance dashboard, Scores, **Leaderboard**, Badges, Vendor performance, Incentives; **Velos** surface; **KRA** scorecards; Agent Activity.

**Exhaustive features:**
- **Performance score engine** — monthly batch over execution tasks computing on-time rate, quality, rework, escalations, avg response, completion → weighted **overall score** (per user *and* vendor).
- **Badges** — 6 types (Speed Star, Quality Champion, Reliability King, Zero-Escalation, Top Performer, Monthly Best); manual award.
- **Incentives** — points + bonus amount, award flow.
- **Velos points ledger** — append-only signed-row ledger, **idempotent** via unique keys, **config-driven point values** (retunable without redeploy via `VelosConfig`); ~23 seeded event types (contract signed, event executed, advance received, site visit, lead overdue penalty…). **Quality gate** (withhold points if review <3/5), **assist credit** (split among prior contributors), **clawback** (reverse on lost/cancelled).
- **Identity arc** — lifetime ladder (Bronze/Silver/Gold/Platinum) with dual sales/ops identities and unlocks.
- **Peer recognition** — kudos (+points, capped per giver/week), kudos wall.
- **Quests** — individual/team, metric-matched to config events, auto-progress on real awards, self-select (Silver+), recovery quests, team-quest rewards (idempotent).
- **KRA scorecards** — role templates (e.g. BDM/Corporate/Inside-Sales) with weighted sections (100 pts), **gate/band/multiplier** scoring engine, **auto-metrics from CRM** vs manual fill, ramp-month thresholds, DRAFT→SUBMITTED→ACKNOWLEDGED.
- **Agent activity** — per-user activity rollups + timeline.

**Automations:** `performance-scores` (prior month), `velos-slump` (slump-catch recovery quests + team-quest settle), `score-decay`. **RBAC:** `performance:read/manage/awards`; org-wide Velos mutations admin/cron-gated. **UI/UX:** **donut progress rings** ("am I winning?", identity %, team target with thresholds), tier pills, leaderboard with deltas + most-improved, quest boards, kudos wall, KRA gate/band/multiplier breakdown.

---

## 3.11 Marketing Growth Engine

**Purpose:** Grow the agency's *own* pipeline — campaigns, loyalty, referrals, reviews, surveys, social, and web-capture surfaces.

**Exhaustive features:**
- **Campaigns** — multichannel bulk (Email/WhatsApp/SMS) with JSON segmentation + lifecycle + stats (shared with §3.4).
- **Loyalty** — 4-tier program (Bronze/Silver/Gold/Platinum via thresholds), earn/redeem points (balance-checked transactional ledger), per-contact accounts.
- **Referrals** — unique 8-char codes (collision-safe), track conversion, tiered reward rules, reward approve→pay, **dashboard + leaderboard + rewards + marketing assets**; simple manual referral CRUD too.
- **Reviews & reputation** — multi-source submission, moderation, owner reply, average rating, solicit reviews from completed work; **AI sentiment** scoring (cron).
- **Surveys** — NPS/CSAT, question CRUD, public response submission, results aggregation.
- **Social** — per-platform posts, schedule/publish lifecycle.
- **Storefront & web capture** — public venue/service browse + inquiry, **embeddable standalone booking/inquiry widget** (JS embed), **dynamic public webforms by slug** (field schema, rate-limited, honeypot), inquiry → lead conversion.

**Entities:** `Campaign`, `LoyaltyAccount`/`Transaction`, `Referral`/`RewardRule`/`Reward`/`Asset`, `Review`, `Survey`/`Question`/`Response`, `SocialPost`, `Webform`/`Submission`, `WidgetInquiry`. **RBAC:** `campaigns:*`, `loyalty:*`, `referrals:*`, `reviews:*`, `surveys:*`, `social:*`, `widget:*`. **UI/UX:** referral leaderboard, embeddable widget, public webforms, review moderation queue.

> **For DigiMark:** extend **Social** into a real **content calendar + multi-account scheduler** (the agency runs clients' social), and turn **Reviews** into **case studies / testimonials**.

---

## 3.12 Analytics, Reporting, Forecasting & AI

**Purpose:** Turn the operational data into decisions — dashboards, ~20 reports, forecasting, and an embedded AI assistant.

**Exhaustive features:**
- **Analytics** — revenue, bookings, lead-conversion funnel, venue utilization, MoM, top clients, cashflow.
- **Reports (~20)** — revenue, booking, pipeline, payment-method, settlement, deposit, discount, client ledger, VIP, GST, net-revenue, daily-ops, task-completion, bookings-by-source, and more; exportable.
- **Forecasting** — budgets CRUD, demand forecast (seasonal multipliers × growth × variance), budget-vs-actual, venue heatmap.
- **Anomalies** — statistical detectors (revenue drop/spike, lead-volume change, cancellation cluster, payment delay, conversion drop) + LLM recommendations; acknowledge/resolve.
- **AI assistant (conversational CRM agent)** — SSE-streaming chat with **tool-calling** (~15 tools: read leads/deals/bookings/revenue/pipeline/availability/contacts/entity-detail **and** write: draft email, create task, log communication); page/entity-aware system prompt; renders inline charts.
- **AI features** — email drafting (tone-aware), entity suggestion cards (Action/Insight/Warning), AI lead/deal scoring, sentiment analysis, anomaly recommendations, demand forecasting.
- **Customer-360 cron** — recomputes per-contact lifetime value/bookings/last-event/segment.

**RBAC:** `analytics:read/advanced`, `dashboard:analytics`, `forecast:read/create`, `ai:use/admin`. **Integrations:** OpenAI/Groq/Gemini fallback chain.

> **For DigiMark:** add **client-facing white-label reporting dashboards** that pull **GA4, Google Ads, Meta Ads, Search Console, and Ahrefs** (SEO/keywords/backlinks/rank/site-audit) — these become scheduled, branded client reports. (An Ahrefs data integration is already available in this environment.)

---

## 3.13 Public & Portal Surfaces

**Purpose:** Self-service surfaces for clients, vendors, guests, and candidates — outside the internal app.

- **Client Portal** (`(portal)`) — dashboard, bookings/projects with **phase-progress + readiness cards**, contracts, invoices, **payments (submit proof / pay via Razorpay)**, documents, gallery, loyalty, reviews, surveys. Exposes the delivery pipeline to the client read-only.
- **Vendor Portal** (`(vendor-portal)`) — dashboard, assigned events/projects, **bids** (submit on open work), payouts.
- **Guest experience** (`(guest)` + public) — venue/service browse + book, **tokenized RSVP**, candidate **onboarding portal**.
- **Public** — careers microsite + apply, public webforms by slug, embeddable widget, RSVP.

**RBAC:** `portal:access/bookings/invoices/payments`, `vendor-portal:access/bids/payouts`; public surfaces are token-based/unauthenticated with rate-limiting + honeypots. **UI/UX:** mobile-first portal cards, phase-progress rings, payment proof upload, branded microsites.

> **For DigiMark:** the **Client Portal is the agency's hero surface** — approvals of creatives/content, deliverable downloads, live campaign reports, retainer scope/hours visibility, and invoice payment.

---

## 3.14 Catalog (Packages / Menu / Pricing → *Service Catalog*)

**Purpose (Veloria):** Packages, Menu, Pricing, Inventory, Rentals catalog. **For DigiMark:** the **productized-services catalog** — SEO/PPC/Social/Content/Web packages, retainer tiers, à-la-carte add-ons, and rate cards used by the proposal builder.

- **Packages** — CRUD + duplicate + tiers + by-type; **Pricing** — rules, rate plans, `calculatePrice`; **Menu** → *deliverable line-items*; Inventory/Rentals → *internal assets/licences/seats* (optional). **RBAC:** `packages:*`, `pricing:*`, `menu:*`, `inventory:*`, `rentals:*`.

---

# Part IV — Automation & Background-Job Registry

Veloria's "it never forgets" feel comes from **7 engines** firing inline + **19 scheduled jobs**. On Vercel Hobby a single daily cron (`0 2 * * *`) fans out to all 19 sequentially (fail-isolated); on Pro, split into per-job schedules and add a 1–5 min pinger for the time-sensitive `fast` job.

## The 7 automation engines (`src/lib/*`)

| Engine | Trigger model | Action model | Where used |
|---|---|---|---|
| **Workflow executor** | Event triggers: Event/Booking Created, Booking Confirmed, Payment Due, Event Tomorrow, Post Event, Lead Created | Ordered actions: Send Email / WhatsApp / Create Task / Notify / Update Status, with `{{token}}` interpolation; re-entrancy guard; per-action try/catch; logs | No-code builder in Settings; fired across CRM/bookings/finance |
| **Cadence executor** | Time: enrollment `nextExecuteAt ≤ now` | Run current step (email/WhatsApp/SMS/task/wait/note), advance or complete | Engagement sequences |
| **Blueprint engine** | Entity status-transition attempts | Validate against active blueprint: allowed roles + required fields + required actions (real record counts); log | Lead/Deal/Booking/Project gating |
| **Escalation engine** | ExecutionTask SLA breach | Match rules by category+priority+delay+level; notify users/roles; dedup | Delivery/ops SLAs |
| **Reminder engine** | Time: reminder `scheduledFor ≤ now` | Staged template send (WhatsApp + SMS fallback) | Guest/event reminders |
| **Approval engine** | Action requiring sign-off | Build ordered approver chain; notify; gate the action; maker-checker | Quotes/deals/bookings/payouts/PRs |
| **Scoring engine** | Entity create/update + cron | Sum active rule points on JSON conditions incl. time-decay | Lead/contact/deal scores |

## The 19 scheduled jobs (`src/app/api/cron/*`, all timing-safe `CRON_SECRET`)

| # | Job | What it does |
|---|---|---|
| 1 | **fast** | Time-sensitive sweep: advance due cadence steps, exit replied cadences, escalate breached first-response SLAs + overdue tasks (run every 1–5 min) |
| 2 | cadence-executor | Process all due cadence steps |
| 3 | escalation-check | Match overdue execution tasks to escalation rules, notify |
| 4 | guest-reminders | Send staged event reminders due now |
| 5 | performance-scores | Compute prior-month staff/vendor performance scores |
| 6 | score-decay | Decay lead/contact/deal scores via rule-sets |
| 7 | ai-scoring | AI-score active leads + deals (bounded, oldest-first) |
| 8 | sentiment-analysis | LLM sentiment on un-scored communications |
| 9 | anomaly-detection | Statistical + LLM anomaly alerts (dedup 24h), notify admins |
| 10 | trash-purge | Garbage-collect old soft-deletes |
| 11 | event-triggers | Fire Event-Tomorrow reminders + Post-Event NPS |
| 12 | customer-360 | Recompute per-contact lifetime value / segment |
| 13 | acq-sla | BD: first-contact breach, follow-up due, onboarding SLA, re-engagement |
| 14 | invoice-due | Mark overdue invoices + fire Payment-Due workflows (due ≤3d) |
| 15 | contract-reminders | Remind on contracts due to sign |
| 16 | project-escalation | Escalate at-risk projects (critical snags / over budget / overdue) to leadership |
| 17 | velos-slump | Slump-catch recovery quests + settle team quests |
| 18 | hold-expiry | Cancel expired booking HOLDs, free the slot |
| 19 | support-sla | Escalate support tickets past priority-based first-response SLA |

---

# Part V — Cross-Cutting Engineering Patterns

These patterns appear in *every* module and are the reason the platform stays correct under concurrency and scale. Reuse them verbatim.

- **Uniform result envelope** — every server action returns `{success: true, data}` or `{success: false, error}`; never throws to the UI.
- **State machines with server-enforced transitions** — illegal status changes are rejected server-side (`isLegalTransition` + entry guards), not just hidden in the UI.
- **Maker-checker / segregation of duties** — the creator of a quote/contract/payout/PR/journal cannot approve it; `SUPER_ADMIN` has a controlled, audited bypass.
- **Idempotency everywhere** — unique keys + status-guarded `updateMany` + relative increments so payments credit exactly once, bridges create venues/invoices exactly once, and cron re-runs are safe (the "dedupe key" pattern).
- **Money math in integer paise** — all balanced-ledger math is integer; Decimal(18,2) at rest; a **DB constraint trigger** rejects unbalanced posted journals.
- **SLA timers with single-fire escalation** — `slaEscalatedAt`/`firstRespondedAt` stamps ensure a breach notifies exactly once.
- **Append-only audit** — `ActivityLog` (+ domain audit logs like `ProjectAuditLog`, statutory access logs) on every mutation.
- **Soft-delete + trash + scheduled purge** — nothing is hard-deleted by users; restore window then GC.
- **Best-effort side-effects** — GL bridges, notifications, and gamification awards are wrapped so a failure never blocks the host transaction (`.catch(console.error)` / `safe()` wrappers).
- **`@db.Date` UTC handling** — date-only fields compared over a UTC-day range, not local-midnight equality (a known gotcha — codify it).
- **Serialization at the boundary** — Decimal/Date serialized to number/ISO in DTOs before crossing to the client.
- **Additive-safe enums-as-strings** — high-churn lifecycles (project phase) stored as normalized strings to avoid destructive migrations.
- **Permission-first rendering** — nav + routes + actions all gated by the same permission strings; the UI never advertises a link that would bounce.

---

# Part VI — UI/UX & Design System Specification

**Design direction:** *colorful but premium.* A token-based system (no hardcoded hex) shipped identically to web and native mobile.

**Design tokens** (`globals.css`, Tailwind v4 `@theme inline`):
- **Color in OKLCH**, light + `.dark` themes. Primary violet `oklch(0.52 0.18 270)`; semantic success/warning/destructive; 5 chart hues; a StatTile accent palette (emerald/blue/violet/amber/pink/cyan/teal/rose).
- **Radius scale** sm→4xl; **safe-area insets** for mobile notches.
- **Fonts:** Inter (sans), Fraunces (display), Geist Mono.

**Component library** (~40 shadcn/Radix primitives in `components/ui/`): button, card, dialog, sheet, sidebar, command, table, tabs, chart, **donut**, **stat-tile**, segmented-control, empty-state, toasts. Shared molecules (`components/shared/`): data-table, status-badge/pill, score-bar, facet-filter-rail, bulk-action-bar, currency-selector, locale-switcher, communication-timeline. Plus `ai/`, `comms/`, `widget/` clusters.

**Layout shell** (`components/layout/`): collapsible permission-aware **sidebar** (icon-mapped, banded nav tree), app header, **⌘K command palette** (recents, quick actions, jump-to, live search), notification popover, page header, brand logo, **contextual page-help** ("?" with plain-English explanation + "rule of thumb" per page).

**Signature UI patterns** (reuse across modules):
- **StatTile dashboards** — colored accent, big number, delta, optional progress ring/streak.
- **Donut progress rings** — health bands (red/amber/green), "am I winning?" goal rings, %-to-next.
- **Kanban boards** — dnd-kit drag-drop (pipeline, tasks, dispatch) with list-view toggle.
- **Workflow stepper** — animated multi-node stage tracker with reopen-to-stage and a compact mobile sheet.
- **Calendar + availability grid + occupancy heatmap.**
- **Detail pages** — 2/3 main + 1/3 side (score/AI/suggestions/timeline).
- **Rules-builder UIs** — dynamic add/remove rows for workflows, escalation, scoring, approval, assignment.
- **Leaderboards, badges, kudos walls** — gamification surfaces.
- **Portals** — mobile-first cards with phase-progress and payment.

**Mobile (Capacitor)**: native iOS + Android, biometric unlock, push + local notifications, camera capture, haptics, share sheet, splash + dark status bar, bottom-nav, safe-area padding, server-URL or bundled modes. A living `/style-guide` page documents everything.

---

# Part VII — Security, Compliance & RBAC

- **Auth hardening** — bcrypt passwords, OAuth, OTP with attempt caps; JWT permissions **re-validated against DB every 5 min** (instant deactivation/role-change enforcement).
- **Three-layer RBAC** — middleware route-prefix gating → edge `authorized()` callback → `hasPermission()` in every action. 19 roles, ~250 permission strings, in-app matrix editor for non-admin roles, separate `acqCan` capability matrix for BD.
- **Encryption at rest** — statutory IDs (PAN/Aadhaar/bank) AES-GCM encrypted; masked by default; every reveal audit-logged.
- **Webhook security** — HMAC verification on Razorpay, WhatsApp (`x-hub-signature-256`, fails closed), telephony (per-config secret); cron secrets compared in constant time.
- **IDOR & abuse guards** — portal clients can only pay their own invoices; public endpoints rate-limited + honeypotted; signed open-redirect guard on tracking links.
- **HTTP security headers** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (via `vercel.json`).
- **Audit & maker-checker** — append-only logs + segregation of duties on all financial and contractual actions.

---

# Part VIII — DigiMark Translation Map & Build Roadmap

DigiMark Agency is a **digital-marketing agency**: SEO, paid media (PPC), social media management, content marketing, web design/dev, branding, email marketing, analytics, and influencer marketing — sold as **retainers + projects**. Below is exactly how each Veloria module maps.

## 8.1 Module-by-module mapping

| Veloria module | DigiMark module | Action |
|---|---|---|
| Sales CRM (lead→quote→contract) | **Sales CRM** (lead→proposal/SOW→retainer contract) | **Keep.** Rename "Quotation" → **Proposal/SOW**; quotation calculator → scope/retainer builder. |
| BD / Acquisition CRM | **Partner & Supplier CRM** | **Adapt.** Source freelancers, influencers, media vendors, white-label/tech partners; same guarded pipeline + CLM + onboarding. |
| Engagement & Comms | **Engagement & Comms** | **Keep.** Add unsubscribe/consent; wire real bulk delivery. |
| Bookings & Event Operations | **Campaign & Delivery Operations** | **Re-point.** Replace venue/slot booking with **campaign scheduling + content calendar + launch ops**; keep HOLD/conflict mechanics for **team-capacity/slot booking** and **media-flight scheduling**. Drop BEO/Kitchen/Seating/RSVP/Menu/Tasting (or repurpose Menu → deliverable line-items). |
| Projects / CapEx delivery | **Client Onboarding + Project/Retainer Delivery** | **Keep & rename.** 9-stage pipeline → client onboarding → kickoff → production → QC → client approval → launch → reporting → renewal. Snags → **revision/QA punch-list**. CapEx calculator → **project budget/effort estimator**. Execution sub-system + SOP templates → **deliverable task generation** (e.g. "SEO audit", "ad-set build", "blog production"). |
| Operations, Supply Chain & Service | **Operations & Service** | **Keep.** Tasks, support (client tickets), workflows, escalation, vendor/freelancer mgmt, resources = **team capacity**. Inventory/Rentals → **software licences/seats/asset library** (optional). |
| Finance, Accounting & Billing | **Finance & Billing** | **Keep + extend.** Add **recurring/retainer billing (subscriptions)**, **media-spend pass-through with markup**, **per-client/per-project profitability & margin**. |
| HR / People & Recruitment | **HR / People & Recruitment** | **Keep.** Make **Timesheets/billable-hours/utilization** real (core agency metric); keep ATS, attendance, leave, payroll, statutory. |
| Performance (Velos) & KRA | **Performance & KRA** | **Keep.** Re-tune Velos events for agency wins (proposal won, retainer renewed, content shipped, ranking improved, ad ROAS hit). KRA templates per role (SEO/PPC/Content/AM). |
| Marketing Growth | **Agency's own Growth** | **Keep + extend.** Social → **multi-account content calendar/scheduler** (you run clients' channels); Reviews → **case studies/testimonials**; referrals/loyalty/webforms/widget unchanged. |
| Analytics, Reporting & AI | **Analytics + Client Reporting + AI** | **Keep + extend big.** Add **white-label client dashboards** pulling **GA4, Google Ads, Meta Ads, Search Console, Ahrefs (SEO/keywords/backlinks/rank/site-audit)**; scheduled branded reports. AI → **content & ad-copy generation, SEO assist, report-narrative writing**. |
| Catalog (Packages/Menu/Pricing) | **Service Catalog** | **Keep & rename.** Productized SEO/PPC/Social/Content/Web packages + retainer tiers + add-ons + rate cards feeding the proposal builder. |
| Client/Vendor/Guest/Careers portals | **Client / Freelancer / Careers portals** | **Keep.** **Client Portal is the hero surface**: creative/content approvals, deliverable downloads, live reports, retainer scope/hours, invoice pay. |
| Platform foundation, automations, design system, mobile | (same) | **Keep verbatim** — identity, dual RBAC, 7 engines, 19 crons, OKLCH design system, Capacitor mobile. |

## 8.2 New capabilities to add for a marketing agency (not in Veloria)

> **Detailed, buildable specs** (data models, screens, server actions, lifecycles, automations, RBAC, formulas) for the first five of these are in the companion doc **[`docs/DigiMark-NetNew-Modules-Spec.md`](DigiMark-NetNew-Modules-Spec.md)**.

1. **Retainer management** — recurring scope, monthly hour allotments, rollover rules, auto-generated recurring invoices, renewal pipeline + alerts.
2. **Time tracking & utilization** — billable vs non-billable hours, per-client/per-project burn vs retainer cap, utilization & realization dashboards (extend HR Timesheets).
3. **Campaign management** — campaigns across SEO/PPC/Social/Email/Content with **budgets, pacing, flight dates, and channel KPIs**; ties to the delivery pipeline.
4. **Media-spend / ad-budget management** — pass-through billing with markup, budget alerts, reconciliation against ad-platform spend.
5. **Content calendar & social scheduler** — multi-account, multi-client publishing with approval workflow (extend `SocialPost`).
6. **Creative/asset management & proofing** — versioned creative review + client approval (extend Documents/Gallery into a DAM with annotation).
7. **Client reporting integrations** — GA4, Google Ads, Meta Ads, Search Console, **Ahrefs** (data available in this environment), LinkedIn/TikTok ads; scheduled white-label PDF/portal reports.
8. **Proposal/SOW builder** — adapt the quotation calculator to scoped deliverables, effort, and retainer pricing with e-sign.
9. **Project profitability** — revenue − (freelancer + media + allocated salaried hours) = margin, per client/project, surfaced in Finance + Analytics.

## 8.3 Suggested integrations for DigiMark

- **Ad/analytics:** Google Ads, Meta Ads, GA4, Google Search Console, **Ahrefs** (SEO/keywords/backlinks/rank/site-audit — already connected here), LinkedIn/TikTok Ads.
- **Creative/production:** Canva (design generation/export — connected here), Figma.
- **Comms:** Slack, Resend, WhatsApp Cloud API, MSG91/Twilio (all already patterned in Veloria).
- **CRM migration:** Zoho CRM import (connected here) for moving existing client/lead data in.
- **Payments/billing:** Razorpay + recurring/subscriptions; optionally Stripe for global clients.
- **AI:** OpenAI/Groq/Gemini (already patterned) for content, ad-copy, report narratives, SEO assist.

## 8.4 Recommended role set (rename Veloria's 19)

`SUPER_ADMIN, ADMIN, SALES_EXEC → ACCOUNT_EXEC, SALES_HEAD → SALES_DIRECTOR, EVENT_COORDINATOR → PROJECT_MANAGER, FINANCE, STAFF → SPECIALIST (SEO/PPC/Social/Content/Design), VENDOR → FREELANCER, CLIENT, BD_EXECUTIVE/BD_HEAD → PARTNERSHIPS_*, OPERATIONS → DELIVERY_OPS, LEGAL, PROJECTS_EXEC/HEAD → DELIVERY_LEAD/DIRECTOR, HR_MANAGER/HR_EXECUTIVE, AUDITOR.` Keep the same `resource:action` permission convention.

## 8.5 Phased build roadmap

| Wave | Modules | Outcome |
|---|---|---|
| **W0 — Foundation** | Platform foundation, auth/RBAC, design system, mobile shell, settings hub, notifications, audit | One login, permissions, themed shell on web + iOS/Android. |
| **W1 — Revenue front-office** | Sales CRM, Engagement & Comms, Service Catalog, Proposal/SOW builder, Client Portal (read) | Capture → nurture → propose → win, with client visibility. |
| **W2 — Delivery** | Project/Retainer Delivery pipeline, Tasks/Execution + SOP templates, Time tracking, Creative proofing, Client Portal (approvals/deliverables) | Deliver work with SLAs, approvals, and utilization. |
| **W3 — Money** | Finance/GL, Invoices (incl. recurring/retainer), Payments (Razorpay), Payouts to freelancers, Media-spend pass-through, Commissions, Profitability | Bill retainers, pay freelancers, see margin per client. |
| **W4 — People & motivation** | HR/People, Attendance/Leave/Shifts, Recruitment/ATS, Performance (Velos) + KRA | Run the team; hire; measure and motivate. |
| **W5 — Growth & intelligence** | Marketing Growth (own pipeline), Content calendar/scheduler, Campaign & media management, Analytics + **white-label client reporting** (GA4/Ads/Ahrefs), AI assistant | Grow the agency; report to clients; automate insight. |
| **W6 — Partners & automation depth** | Partner/Supplier CRM, Vendor/Freelancer portal, full workflow/blueprint/escalation/approval engine config, all 19 crons | Scale supply side; fully automated operations. |

---

### Appendix A — Scale of the reference build (Veloria)

- **244** Prisma models · **128** enums · **6,279-line** schema
- **152** server-action modules · **69** Zod schema files · **~55** library/engine files
- **~57** dashboard routes · **5** public/portal route groups · native **iOS + Android** apps
- **19** scheduled jobs · **7** automation engines · **19** RBAC roles · **~250** permissions
- **~40** UI primitives + shared molecules · OKLCH token system · 4 locales

### Appendix B — Known gaps in the reference to fix in DigiMark

- Add **opt-out/unsubscribe/consent** across comms (none today).
- **Campaign bulk-send** is partially mocked — wire real delivery + accurate stats.
- **Cadence auto-enroll** is schema-only — add the evaluator.
- HR **Timesheets/OKR/Engagement/LMS/Compensation** are placeholders — build them (Timesheets is critical for an agency).
- **Workflow `delayMinutes`** is stored but not honored — implement delayed actions.
- E-sign and Tally sync are **adapters/stubs** — wire real providers.
- Move time-sensitive crons off the single daily fan-out to a **1–5 min pinger or Vercel Pro** schedules.

*End of blueprint.*
