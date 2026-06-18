# DigiMark Agency — Net-New Module Specs
### Detailed, buildable specifications for the 5 agency-specific modules not present in Veloria

**Companion to:** `docs/DigiMark-Agency-Blueprint.md` (Part VIII.2 references these).
**Convention:** All specs follow Veloria's engineering patterns from Part V of the blueprint — uniform `{success,data}|{success,error}` action envelope, **money in integer paise** (Decimal(18,2) at rest), **idempotency keys** on all generators/cron, **server-enforced state machines**, **maker-checker** on financial actions, append-only `ActivityLog`, `entityId` multi-tenant discriminator, `deletedAt` soft-delete, serialize-at-boundary. Prisma models below are illustrative field lists, not final migrations.

**The five modules and how they interlock:**

```
                 ┌─────────────────────┐
   Sales CRM ───►│  RETAINER BILLING    │◄──── Service Catalog (scope/rates)
   (won SOW)     │  (recurring revenue) │
                 └────────┬────────────┘
                          │ includedHours, period burn
                          ▼
   Tasks/Delivery ──► TIME-TRACKING ──► Finance (billable lines, invoices)
   (log time)          (utilization)     ▲
                          │              │ pass-through media billing + markup
                          ▼              │
   CAMPAIGN & MEDIA ──────┴──────────────┘
   (budgets, pacing, spend)   │ channel metrics
                              ▼
   CONTENT CALENDAR ──► CLIENT REPORTING ──► Client Portal (live dashboards)
   (publish + approve)   (white-label, GA4/Ads/Ahrefs)
```

---

# Module 1 — Retainer Billing & Recurring Revenue

## A. Purpose & fit
Agencies live on **monthly recurring revenue (MRR)**. This module manages recurring client agreements: scoped deliverables, included-hours allotments, automatic invoice generation each cycle, hour rollover/overage rules, and a renewal/churn pipeline. It sits between **Sales CRM** (a won SOW becomes a retainer), **Time-tracking** (hours burn against the cap), and **Finance** (generated invoices post to the GL).

## B. Data model
```prisma
model Retainer {
  id                String   @id @default(cuid())
  entityId          String   @default("DIGIMARK")
  clientId          String                       // → Contact
  contractId        String?                      // → signed Contract/SOW
  ownerId           String                       // account manager (User)
  name              String
  status            RetainerStatus @default(DRAFT)
  billingCycle      BillingCycle   @default(MONTHLY)
  amount            Decimal  @db.Decimal(18,2)   // recurring fee per cycle
  currency          String   @default("INR")
  includedHours     Decimal  @db.Decimal(8,2)    // hours bundled per cycle
  overageRate       Decimal  @db.Decimal(10,2)   // per-hour rate beyond cap
  rolloverPolicy    RolloverPolicy @default(NONE)
  rolloverCapHours  Decimal  @db.Decimal(8,2) @default(0)
  startDate         DateTime
  endDate           DateTime?                     // null = open-ended
  autoRenew         Boolean  @default(true)
  renewalNoticeDays Int      @default(30)
  billingDay        Int      @default(1)          // 1–28
  nextInvoiceDate   DateTime
  poNumber          String?
  scopeItems        RetainerScopeItem[]
  periods           RetainerPeriod[]
  renewals          RetainerRenewal[]
  deletedAt         DateTime?
  createdAt         DateTime @default(now())
  @@index([entityId, status, nextInvoiceDate])
}

model RetainerScopeItem {
  id            String @id @default(cuid())
  retainerId    String
  category      ServiceCategory      // SEO/PPC/SOCIAL/CONTENT/WEB/EMAIL/DESIGN
  title         String
  quantityPerCycle Int   @default(1) // e.g. 8 blog posts / month
  unit          String?              // "posts", "hours", "campaigns"
  hoursEstimate Decimal @db.Decimal(8,2) @default(0)
}

model RetainerPeriod {
  id             String @id @default(cuid())
  retainerId     String
  periodStart    DateTime @db.Date
  periodEnd      DateTime @db.Date
  includedHours  Decimal @db.Decimal(8,2)
  hoursRolledIn  Decimal @db.Decimal(8,2) @default(0)
  hoursUsed      Decimal @db.Decimal(8,2) @default(0)   // rolled up from approved TimeEntries
  overageHours   Decimal @db.Decimal(8,2) @default(0)
  overageAmount  Decimal @db.Decimal(18,2) @default(0)
  status         RetainerPeriodStatus @default(OPEN)    // OPEN→CLOSED→INVOICED
  invoiceId      String?
  @@unique([retainerId, periodStart])                   // idempotent generation
}

model RetainerRenewal {
  id          String @id @default(cuid())
  retainerId  String
  dueDate     DateTime
  status      RenewalStatus @default(UPCOMING) // UPCOMING/IN_NEGOTIATION/RENEWED/CHURNED
  proposedAmount Decimal? @db.Decimal(18,2)
  ownerId     String
  notes       String?
}

enum RetainerStatus       { DRAFT ACTIVE PAUSED ENDED CHURNED }
enum BillingCycle         { MONTHLY QUARTERLY ANNUAL }
enum RolloverPolicy       { NONE PARTIAL FULL }
enum RetainerPeriodStatus { OPEN CLOSED INVOICED }
enum RenewalStatus        { UPCOMING IN_NEGOTIATION RENEWED CHURNED }
```

## C. Screens & routes
- `/retainers` — list with **MRR / ARR / churn / avg-utilization** StatTiles; filter by status/owner/cycle.
- `/retainers/new`, `/retainers/[id]` (detail: scope, current-period **burn ring**, invoice history, renewal panel, linked project/contract), `/retainers/[id]/edit`.
- `/retainers/renewals` — **renewals kanban** (Upcoming / In-Negotiation / Renewed / Churned).
- `/retainers/mrr` — MRR/ARR movement dashboard (new / expansion / contraction / churn waterfall).

## D. Key server actions (`retainer.actions.ts`)
`createRetainer`, `activateRetainer` (DRAFT→ACTIVE, seeds first `RetainerPeriod` + sets `nextInvoiceDate`), `updateRetainer`, `pauseRetainer`/`resumeRetainer`, `endRetainer`/`markChurned`, `addScopeItem`/`updateScopeItem`/`removeScopeItem`, `generatePeriodInvoice(retainerId, periodId)` (idempotent — see automations), `closePeriod` (finalize hoursUsed → compute overage), `getRetainerBurn(retainerId)`, `getMrrMovement(range)`, `createRenewal`/`advanceRenewal`.

## E. Lifecycle
- **Retainer:** `DRAFT → ACTIVE → (PAUSED ⇄ ACTIVE) → ENDED | CHURNED`.
- **Period:** `OPEN → CLOSED → INVOICED`.
- **Renewal:** `UPCOMING → IN_NEGOTIATION → RENEWED | CHURNED`.

## F. Automations (new crons, added to the daily fan-out)
- **`retainer-billing`** (daily): for each ACTIVE retainer with `nextInvoiceDate ≤ today`: in a transaction — close the open period (finalize `hoursUsed`, compute `overageHours`/`overageAmount`), generate an `Invoice` (reuse Finance `createInvoice` + AR GL bridge) with the recurring fee + overage line, mark period INVOICED, open the next period (apply rollover), advance `nextInvoiceDate` by the cycle. **Idempotent** on `RetainerPeriod @@unique(retainerId, periodStart)`.
- **`retainer-renewals`** (daily): for ACTIVE retainers within `renewalNoticeDays` of `endDate` (or open-ended at an anniversary) with no open renewal → create `RetainerRenewal(UPCOMING)` + notify owner.
- **Burn alerts** (in time-tracking rollup): when period `hoursUsed` crosses 80% / 100% of `includedHours + hoursRolledIn` → notify owner + flag in client portal.

## G. RBAC
`retainers:read`, `retainers:create`, `retainers:update`, `retainers:delete`, `retainers:invoice` (gate auto/manual invoicing), `retainers:manage` (renewals/MRR). Account managers see their own; directors/finance see all.

## H. UI/UX
Retainer detail leads with a **donut burn ring** (hours used vs cap, amber at 80%, red at 100%). MRR dashboard uses a **waterfall** (new/expansion/contraction/churn). Renewals as a kanban. Reuses StatTiles, status pills, `en-IN` currency, `tabular-nums`.

## I. Integrations
Finance (Invoice + AR GL bridge, Razorpay payment links / subscriptions), Sales CRM (won SOW → `createRetainer`), Contract (link signed SOW), Time-tracking (hours burn), Service Catalog (scope items + rate cards).

## J. Key formulas (integer paise)
- `rolloverIn = policy==NONE ? 0 : min(rolloverCapHours, max(0, prevIncluded + prevRolledIn − prevUsed))` (PARTIAL caps it, FULL ignores cap).
- `overageHours = max(0, hoursUsed − (includedHours + hoursRolledIn))`; `overageAmount = overageHours × overageRate`.
- `MRR = Σ active retainer.amount normalized to monthly`; `ARR = MRR × 12`; period burn % = `hoursUsed / (includedHours + hoursRolledIn)`.

---

# Module 2 — Time-Tracking, Timesheets & Utilization

## A. Purpose & fit
The agency's profitability engine. Every billable hour is tracked against a client/project/retainer, approved, and rolled into **utilization** (are people busy?) and **realization** (are we charging for it?). Feeds retainer burn, project margin, and T&M invoicing. (Veloria ships Timesheets as a placeholder — this makes it real.)

## B. Data model
```prisma
model TimeEntry {
  id            String   @id @default(cuid())
  entityId      String   @default("DIGIMARK")
  employeeId    String                          // → Employee/User
  date          DateTime @db.Date
  clientId      String?
  projectId     String?                         // → delivery project
  retainerId    String?
  taskId        String?                         // → Task/ExecutionTask
  serviceCategory ServiceCategory?
  durationMinutes Int
  billable      Boolean  @default(true)
  billableRate  Decimal? @db.Decimal(10,2)      // snapshot at entry time
  description   String
  status        TimeEntryStatus @default(DRAFT) // DRAFT→SUBMITTED→APPROVED/REJECTED→INVOICED
  source        TimeSource @default(MANUAL)     // MANUAL/TIMER/IMPORT
  timesheetId   String?
  approvedById  String?
  invoiceLineId String?
  createdAt     DateTime @default(now())
  @@index([employeeId, date])
  @@index([retainerId, status])
  @@index([projectId, status])
}

model Timesheet {
  id            String @id @default(cuid())
  employeeId    String
  weekStart     DateTime @db.Date
  status        TimesheetStatus @default(OPEN)  // OPEN→SUBMITTED→APPROVED/REJECTED
  totalMinutes  Int @default(0)
  billableMinutes Int @default(0)
  submittedAt   DateTime?
  approvedById  String?
  @@unique([employeeId, weekStart])
}

model CapacityAllocation {
  id            String @id @default(cuid())
  employeeId    String
  weekStart     DateTime @db.Date
  capacityMinutes Int   @default(2400)          // 40h default
  plannedMinutes  Int   @default(0)
  clientId      String?
  projectId     String?
  @@index([employeeId, weekStart])
}

model BillableRate {
  id          String @id @default(cuid())
  scope       RateScope            // EMPLOYEE/ROLE/CLIENT/PROJECT
  scopeRefId  String
  rate        Decimal @db.Decimal(10,2)
  effectiveFrom DateTime @db.Date
}

enum TimeEntryStatus { DRAFT SUBMITTED APPROVED REJECTED INVOICED }
enum TimesheetStatus { OPEN SUBMITTED APPROVED REJECTED }
enum TimeSource      { MANUAL TIMER IMPORT }
enum RateScope       { EMPLOYEE ROLE CLIENT PROJECT }
```

## C. Screens & routes
- `/people/timesheets` — **weekly grid** (rows = client/project, columns = Mon–Sun), inline cells, running totals, submit button; a **live timer widget** (start/stop against a task).
- `/people/timesheets/approvals` — manager approval queue (by org-chart match, reuse HR pattern).
- `/people/utilization` — utilization dashboard: per-person and team **heatmap**, billable-vs-non-billable **donut**, realization %, effective-rate trend.
- `/people/capacity` — capacity planner (allocations vs capacity, over-allocation flags).
- Embedded **timer on Task/Execution detail** ("Log time").

## D. Key server actions (`time.actions.ts`)
`logTime` (manual), `startTimer`/`stopTimer` (creates a TIMER entry), `updateTimeEntry`, `submitTimesheet(weekStart)` (OPEN→SUBMITTED, snapshots totals), `approveTimesheet`/`rejectTimesheet` (rolls approved hours into `RetainerPeriod.hoursUsed` and `Project.hoursUsed`), `getUtilization(scope, range)`, `getRealization(scope, range)`, `setCapacity`/`allocate`, `resolveBillableRate(entry)` (precedence PROJECT → CLIENT → EMPLOYEE → ROLE).

## E. Lifecycle
TimeEntry `DRAFT → SUBMITTED → APPROVED | REJECTED → INVOICED`; Timesheet `OPEN → SUBMITTED → APPROVED | REJECTED`.

## F. Automations
- **`timesheet-reminders`** (cron, Fri PM + Mon AM): nudge employees with unsubmitted timesheets; escalate to manager after deadline.
- **Rollup on approve** (inline): approved billable minutes increment the linked `RetainerPeriod.hoursUsed` / `Project.hoursUsed`, triggering burn alerts (Module 1).
- **T&M invoice draft**: monthly, approved billable entries on T&M (non-retainer) projects → draft invoice lines (reuse Finance), then mark entries INVOICED (idempotent on `invoiceLineId`).

## G. RBAC
`timesheets:read`, `timesheets:write` (own), `timesheets:approve` (managers + `hr:approve`), `time:report` (utilization/realization dashboards), `rates:manage`.

## H. UI/UX
Excel-like weekly grid with keyboard nav, timer chip in the header, utilization **heatmap** (green 70–90% healthy, red >100% over-capacity, grey idle), realization donut, capacity bars. Reuses dnd for drag-allocating capacity.

## I. Integrations
Tasks/Execution (timer source), Retainer (burn), Projects (margin: hours × cost-rate vs budget), Finance (billable → invoice lines), HR (employee + cost rate + approval routing).

## J. Key formulas
- **Utilization %** = billable minutes / capacity minutes.
- **Realization %** = invoiced value / (billable hours × standard rate).
- **Effective hourly rate** = revenue attributed / hours.
- **Project margin** = revenue − Σ(hours × employee cost-rate) − media − freelancer cost.

---

# Module 3 — Campaign & Media-Spend Management

## A. Purpose & fit
Plan, run, and bill **paid-media and multi-channel campaigns** for clients: budgets, flights, pacing, channel KPIs, and **media-spend pass-through billing with markup**. Pulls actual spend + performance from ad platforms, reconciles it (bank-recon pattern), and feeds both Finance (billing) and Client Reporting (KPIs).
> Naming: this is **`ClientCampaign`** / `paidmedia:*` — distinct from Veloria's outbound comms `Campaign` (email/SMS blasts).

## B. Data model
```prisma
model ClientCampaign {
  id            String   @id @default(cuid())
  entityId      String   @default("DIGIMARK")
  clientId      String
  retainerId    String?
  projectId     String?
  name          String
  channel       MediaChannel        // PPC_GOOGLE/PPC_META/LINKEDIN/TIKTOK/PROGRAMMATIC/SEO/SOCIAL_ORGANIC/EMAIL/CONTENT/INFLUENCER
  objective     CampaignObjective   // AWARENESS/TRAFFIC/LEADS/SALES/RETENTION
  status        CampaignStatus @default(PLANNED) // PLANNED→ACTIVE→PAUSED→COMPLETED/CANCELLED
  startDate     DateTime
  endDate       DateTime?
  budgetAmount  Decimal @db.Decimal(18,2)
  budgetType    BudgetType @default(MONTHLY)     // TOTAL/DAILY/MONTHLY
  markupPct     Decimal @db.Decimal(5,2) @default(0)  // agency margin on media
  kpiTargets    Json?    // { cpl: 800, roas: 4.0, ctr: 2.5 }
  externalRef   String?  // ad-account/campaign id
  ownerId       String
  flights       CampaignFlight[]
  spends        MediaSpend[]
  metrics       CampaignMetricDaily[]
  deletedAt     DateTime?
  @@index([entityId, status])
  @@index([clientId, channel])
}

model CampaignFlight {
  id          String @id @default(cuid())
  campaignId  String
  name        String
  startDate   DateTime @db.Date
  endDate     DateTime @db.Date
  budget      Decimal @db.Decimal(18,2)
}

model MediaSpend {
  id            String @id @default(cuid())
  campaignId    String
  date          DateTime @db.Date
  source        SpendSource          // GOOGLE_ADS/META/LINKEDIN/MANUAL
  plannedSpend  Decimal @db.Decimal(18,2) @default(0)
  actualSpend   Decimal @db.Decimal(18,2) @default(0)
  billableToClient Decimal @db.Decimal(18,2) @default(0) // actual × (1+markup)
  reconStatus   ReconStatus @default(UNMATCHED)          // UNMATCHED/MATCHED/RECONCILED
  externalSpendRef String?
  invoiceLineId String?
  @@unique([campaignId, date, source])                   // idempotent sync
}

model CampaignMetricDaily {
  id          String @id @default(cuid())
  campaignId  String
  date        DateTime @db.Date
  impressions Int @default(0)
  clicks      Int @default(0)
  spend       Decimal @db.Decimal(18,2) @default(0)
  conversions Int @default(0)
  revenue     Decimal @db.Decimal(18,2) @default(0)
  @@unique([campaignId, date])
}

enum MediaChannel     { PPC_GOOGLE PPC_META LINKEDIN TIKTOK PROGRAMMATIC SEO SOCIAL_ORGANIC EMAIL CONTENT INFLUENCER }
enum CampaignObjective{ AWARENESS TRAFFIC LEADS SALES RETENTION }
enum CampaignStatus   { PLANNED ACTIVE PAUSED COMPLETED CANCELLED }
enum BudgetType       { TOTAL DAILY MONTHLY }
enum SpendSource      { GOOGLE_ADS META LINKEDIN MANUAL }
enum ReconStatus      { UNMATCHED MATCHED RECONCILED }
```

## C. Screens & routes
- `/campaigns` (client-campaigns) — list with **pacing bars** (spend vs budget), status, channel, KPI-vs-target chips.
- `/campaigns/[id]` — detail: **flights timeline** (Gantt), daily metric charts (impressions/clicks/spend/conversions/ROAS), KPI scorecards vs target, **spend reconciliation** panel.
- `/campaigns/plan` — media plan/budget board (allocate budget across channels/flights).
- `/campaigns/pacing` — pacing alerts inbox (over/under-pacing, budget consumed ≥ X%).

## D. Key server actions (`client-campaign.actions.ts`)
`createCampaign`, `launchCampaign` (PLANNED→ACTIVE), `pauseCampaign`/`resumeCampaign`, `completeCampaign`, `addFlight`, `recordManualSpend`, `syncSpendFromPlatform(campaignId)` (idempotent upsert on `@@unique(campaignId,date,source)`), `reconcileSpend`, `computePacing(campaignId)`, `generateMediaInvoiceLines(period)` (markup pass-through → Finance), `getCampaignPerformance(campaignId, range)`.

## E. Lifecycle
Campaign `PLANNED → ACTIVE → (PAUSED ⇄ ACTIVE) → COMPLETED | CANCELLED`; Spend recon `UNMATCHED → MATCHED → RECONCILED` (reuses Veloria's bank-recon match-scoring pattern).

## F. Automations (new crons)
- **`media-spend-sync`** (daily): for each ACTIVE campaign with a connected ad account, pull yesterday's spend + metrics → upsert `MediaSpend` + `CampaignMetricDaily` (idempotent). Compute `billableToClient = actualSpend × (1+markupPct)`.
- **`budget-pacing`** (daily): compute pacing per campaign/flight; alert owner + client-portal flag when over-pacing (>110%), under-pacing (<90%), or budget consumed ≥ 90%.
- **Monthly media billing**: roll RECONCILED spend into pass-through invoice lines (markup) → Finance; mark `invoiceLineId` (idempotent).

## G. RBAC
`paidmedia:read`, `paidmedia:create`, `paidmedia:update`, `paidmedia:manage`, `paidmedia:reconcile`, `paidmedia:bill`.

## H. UI/UX
Pacing bars (green on-pace, amber/red off-pace), flights Gantt, KPI scorecards (value vs target with delta colors), reconciliation grid (platform spend vs recorded), channel-mix donut. Reuses Recharts + StatTiles.

## I. Integrations
**Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads** (spend + metrics), **GA4** (conversions/revenue), Finance (pass-through billing + GL), Client Reporting (feeds dashboards), Retainer/Project (campaign belongs to an engagement).

## J. Key formulas
- **Pacing** = actualSpend / (budget × elapsedFraction); flag if >1.1 or <0.9.
- **Billable media** = actualSpend × (1 + markupPct); **media margin** = billable − actual.
- **CPL** = spend / leads; **ROAS** = revenue / spend; **CTR** = clicks / impressions.

---

# Module 4 — Content Calendar & Social Scheduler

## A. Purpose & fit
The agency produces and publishes content across clients' channels. This module is the **editorial calendar + multi-account scheduler + approval workflow** (internal review → client approval → publish). Extends Veloria's simple `SocialPost` into a multi-account, multi-client, multi-channel content pipeline tied to campaigns and creatives.

## B. Data model
```prisma
model ContentItem {
  id            String   @id @default(cuid())
  entityId      String   @default("DIGIMARK")
  clientId      String
  campaignId    String?
  projectId     String?
  channel       ContentChannel  // BLOG/INSTAGRAM/FACEBOOK/LINKEDIN/X/YOUTUBE/TIKTOK/EMAIL/GMB
  title         String
  copy          String?         // post body / caption
  assetIds      String[]        // → Document/Gallery (creatives)
  scheduledAt   DateTime?
  status        ContentStatus @default(IDEA)
  assigneeId    String?
  socialAccountId String?
  externalPostId  String?       // platform post id after publish
  publishResult Json?
  deletedAt     DateTime?
  approvals     ContentApproval[]
  createdAt     DateTime @default(now())
  @@index([entityId, clientId, scheduledAt])
  @@index([status, scheduledAt])
}

model ContentApproval {
  id            String @id @default(cuid())
  contentItemId String
  stage         ApprovalStage     // INTERNAL/CLIENT
  reviewerId    String?           // staff or portal client user
  decision      ApprovalDecision @default(PENDING) // PENDING/APPROVED/CHANGES_REQUESTED
  round         Int @default(1)
  comments      String?
  decidedAt     DateTime?
}

model SocialAccount {
  id            String @id @default(cuid())
  clientId      String
  platform      ContentChannel
  accountName   String
  externalAccountId String
  accessTokenRef String              // encrypted at rest (AES-GCM)
  status        AccountStatus @default(CONNECTED) // CONNECTED/EXPIRED/DISCONNECTED
  expiresAt     DateTime?
}

enum ContentChannel  { BLOG INSTAGRAM FACEBOOK LINKEDIN X YOUTUBE TIKTOK EMAIL GMB }
enum ContentStatus   { IDEA DRAFT IN_REVIEW CLIENT_APPROVAL APPROVED SCHEDULED PUBLISHED FAILED ARCHIVED }
enum ApprovalStage   { INTERNAL CLIENT }
enum ApprovalDecision{ PENDING APPROVED CHANGES_REQUESTED }
enum AccountStatus   { CONNECTED EXPIRED DISCONNECTED }
```

## C. Screens & routes
- `/content` — **month/week calendar** (drag to reschedule, color by channel/status), filter by client/channel/status; **kanban** view by status.
- `/content/[id]` — composer with **per-channel live preview**, asset picker, schedule control, approval thread.
- `/content/accounts` — connected social accounts per client (OAuth connect/reconnect).
- Client-portal mirror: `/portal/approvals` — client sees items in `CLIENT_APPROVAL`, approves or requests changes.

## D. Key server actions (`content.actions.ts`)
`createContentItem`, `updateContent`, `submitForInternalReview` (DRAFT→IN_REVIEW), `internalApprove` (→CLIENT_APPROVAL or APPROVED), `requestClientApproval`, `clientDecision` (portal — APPROVED→ schedulable / CHANGES_REQUESTED→DRAFT, new round), `schedule(contentId, when)` (APPROVED→SCHEDULED), `publishNow`, `connectSocialAccount`/`refreshToken`, `getCalendar(range, filters)`.

## E. Lifecycle
`IDEA → DRAFT → IN_REVIEW → CLIENT_APPROVAL → APPROVED → SCHEDULED → PUBLISHED` with `CHANGES_REQUESTED → DRAFT` loop and `FAILED → (retry) SCHEDULED`. Each approval round increments `ContentApproval.round`.

## F. Automations (new crons)
- **`content-publisher`** (every 15 min via the `fast` lane): publish `SCHEDULED` items with `scheduledAt ≤ now` via the platform API; on success → PUBLISHED + store `externalPostId`; on failure → FAILED + notify assignee. **Idempotent** (publish guarded by status transition + `externalPostId` presence).
- **`content-approval-reminders`** (daily): nudge reviewers/clients with pending approvals; escalate when an item's `scheduledAt` is near but still unapproved.
- **Token refresh**: refresh `SocialAccount` tokens before expiry; mark EXPIRED + alert if refresh fails.

## G. RBAC
`content:read`, `content:create`, `content:update`, `content:approve` (internal), `content:publish`, `social-accounts:manage`. Client approval flows through `portal:approvals`.

## H. UI/UX
Calendar with channel-colored chips + status borders; drag-drop reschedule; per-channel composer previews (IG square, X char-count, LinkedIn); threaded approval comments with round history; bulk scheduler. Reuses dnd-kit + the calendar primitive.

## I. Integrations
Meta/Instagram Graph, LinkedIn, X, YouTube, TikTok, Google Business Profile; **Creative/DAM** (assets — extend Documents/Gallery with versioned proofing + annotation); **Canva** (generate/import creatives — connected in this environment); Client Portal (approvals); Campaign (content ↔ campaign).

---

# Module 5 — Client Reporting (White-Label)

## A. Purpose & fit
The agency's retention surface: **automated, branded, white-label performance reports** combining GA4, Google/Meta Ads, Search Console, and **Ahrefs** (SEO) into a scheduled PDF + a live client-portal dashboard, with an AI-written narrative. Closes the loop — the data the delivery + media modules produce is packaged for the client.

## B. Data model
```prisma
model IntegrationConnection {
  id            String @id @default(cuid())
  entityId      String @default("DIGIMARK")
  clientId      String
  provider      DataProvider     // GA4/GOOGLE_ADS/META_ADS/SEARCH_CONSOLE/AHREFS/LINKEDIN_ADS
  externalAccountId String
  propertyId    String?
  credentialsRef String           // encrypted at rest
  status        ConnectionStatus @default(CONNECTED)
  lastSyncedAt  DateTime?
  @@unique([clientId, provider, externalAccountId])
}

model MetricSnapshot {
  id          String @id @default(cuid())
  clientId    String
  provider    DataProvider
  metricKey   String          // "sessions","conversions","spend","avg_position","domain_rating",...
  period      String          // "2026-05" or ISO date
  value       Decimal @db.Decimal(18,4)
  dims        Json?           // { channel:"organic", country:"IN" }
  @@unique([clientId, provider, metricKey, period])  // idempotent sync
}

model ReportTemplate {
  id          String @id @default(cuid())
  name        String
  sections    Json    // ordered widget configs
  branding    Json    // { logoUrl, primaryColor, footer } — per-client white-label
  cadence     ReportCadence @default(MONTHLY)
  isDefault   Boolean @default(false)
}

model ClientReport {
  id            String @id @default(cuid())
  clientId      String
  templateId    String
  periodStart   DateTime @db.Date
  periodEnd     DateTime @db.Date
  status        ReportStatus @default(DRAFT) // DRAFT→GENERATING→READY→SENT→VIEWED
  dataSnapshot  Json?       // frozen metrics at generation
  narrative     String?     // AI-written summary
  pdfUrl        String?
  generatedAt   DateTime?
  sentAt        DateTime?
  viewedAt      DateTime?
  @@unique([clientId, templateId, periodStart])   // idempotent generation
}

model ReportSchedule {
  id          String @id @default(cuid())
  clientId    String
  templateId  String
  cadence     ReportCadence
  dayOfMonth  Int @default(3)
  recipients  String[]
  deliveryChannel DeliveryChannel @default(BOTH) // EMAIL/PORTAL/BOTH
  active      Boolean @default(true)
}

enum DataProvider    { GA4 GOOGLE_ADS META_ADS SEARCH_CONSOLE AHREFS LINKEDIN_ADS }
enum ConnectionStatus{ CONNECTED EXPIRED DISCONNECTED }
enum ReportCadence   { WEEKLY MONTHLY QUARTERLY }
enum ReportStatus    { DRAFT GENERATING READY SENT VIEWED }
enum DeliveryChannel { EMAIL PORTAL BOTH }
```

## C. Screens & routes
- `/reports/clients` — list of generated client reports (status, period, last-viewed).
- `/reports/builder/[templateId]` — **drag-widget report builder** with white-label preview.
- `/reports/schedules` — scheduled reports (cadence, recipients, delivery).
- `/settings/integrations/data-sources` — per-client connections (OAuth connect GA4/Ads/Search Console; API-key Ahrefs).
- Client portal: `/portal/reports` — **live hosted dashboard** + downloadable branded PDF.

## D. Key server actions (`reporting.actions.ts`)
`connectDataSource`, `syncMetrics(clientId, provider, period)` (idempotent upsert on `MetricSnapshot` unique), `createTemplate`/`updateTemplate`, `generateReport(clientId, templateId, period)` (assemble snapshot → freeze `dataSnapshot` → AI `narrative` → render PDF → READY; idempotent on `ClientReport` unique), `sendReport` (→ Resend + portal; stamps SENT), `markViewed` (portal), `getLiveDashboard(clientId, range)`.

## E. Lifecycle
`DRAFT → GENERATING → READY → SENT → VIEWED`.

## F. Automations (new crons)
- **`report-data-sync`** (daily): refresh `MetricSnapshot` from all CONNECTED sources (idempotent).
- **`report-generator`** (daily, fires per `ReportSchedule.dayOfMonth`): generate the period report → freeze snapshot → AI narrative → render PDF → READY → deliver (email + portal) → SENT. Idempotent on `ClientReport @@unique(clientId, templateId, periodStart)`.
- **AI narrative**: reuse the multi-provider AI engine to write the period summary + flag wins/risks from `MetricSnapshot` deltas.

## G. RBAC
`reports:read`, `reports:create`, `reports:manage`, `reports:send`, `integrations:manage`. Clients see only their own reports (`portal:reports`, IDOR-guarded).

## H. UI/UX
Drag-widget builder with white-label live preview; report cards with status + viewed-state; live portal dashboard (trend charts, ranking movements, ROAS, channel mix, goal completion); MoM delta chips. Reuses Recharts, StatTiles, donut rings.

## I. Integrations
**GA4 Data API, Google Ads, Google Search Console, Meta Ads, Ahrefs** (rank/keywords/backlinks/site-audit/web-analytics — available in this environment), LinkedIn/TikTok Ads; AI (narrative); Client Portal (hosting); Resend (delivery); PDF renderer.

## J. Key widgets/metrics
Traffic by channel (GA4), goal/conversion completion, paid ROAS + CPL (Ads), keyword ranking movement + share-of-voice + domain rating + backlinks (Ahrefs), social growth, MoM/QoQ deltas, AI narrative summary.

---

# Cross-cutting additions (apply once)

### New cron jobs (add to the daily fan-out `JOBS` array)
`retainer-billing`, `retainer-renewals`, `timesheet-reminders`, `media-spend-sync`, `budget-pacing`, `content-publisher` (on the 15-min `fast` lane), `content-approval-reminders`, `report-data-sync`, `report-generator`.

### New permission namespaces (extend `src/lib/permissions.ts`)
`retainers:*`, `timesheets:*` + `time:report` + `rates:manage`, `paidmedia:*`, `content:*` + `social-accounts:manage`, `reports:*` + `integrations:manage`, plus portal scopes `portal:approvals`, `portal:reports`.

### New role grants (illustrative)
- **ACCOUNT_EXEC / PROJECT_MANAGER**: retainers:read, timesheets:write, paidmedia:read, content:create/update, reports:read.
- **DELIVERY_LEAD / DIRECTOR**: + retainers:manage, paidmedia:manage, content:approve/publish, reports:manage, timesheets:approve.
- **FINANCE**: + retainers:invoice, paidmedia:bill, time:report.
- **SPECIALIST**: timesheets:write, content:create/update, paidmedia:update (own campaigns).
- **CLIENT (portal)**: portal:approvals, portal:reports (own only).

### Reused Veloria patterns (do not reinvent)
- Idempotent generators via DB `@@unique` (retainer periods, media spend/day, metric snapshots, client reports) — exactly the booking-number / payment-capture pattern.
- Maker-checker on retainer overage invoicing + media pass-through billing.
- Bank-recon match-scoring reused for media-spend reconciliation.
- AR GL bridge (Finance) reused for every generated invoice; best-effort so billing never blocks delivery.
- AES-GCM encryption at rest for `SocialAccount.accessTokenRef` and `IntegrationConnection.credentialsRef` (same as HR statutory IDs).
- Approval engine + Client Portal reused for content client-approvals.

*End of net-new module specs.*
