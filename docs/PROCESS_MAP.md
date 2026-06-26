# VeloriaApp — Business Process Map

_End-to-end operational process map of the team-side ERP, reconstructed from the actual code (server actions, Prisma enums, RBAC, cron/automation). Each process lists its real status values, the action that drives each transition, who can do it, the system side-effects, and the handoffs between processes._

Diagrams are written in **Mermaid** (renders on GitHub and most markdown viewers).

---

## 0. The value chain (how the processes connect)

```mermaid
flowchart LR
  subgraph ACQ[BD Acquisition]
    A1[Hall-owner lead] --> A2[Deal] --> A3[Contract signed]
  end
  subgraph PRJ[Projects]
    A3 --> P1[Onboard venue<br/>9-stage] --> P2[Venue LIVE]
  end
  subgraph SALES[Sales]
    P2 --> S1[Customer inquiry/lead] --> S2[Quotation] --> S3[Booking] --> S4[Payment]
  end
  subgraph OPS[Event Ops]
    S3 --> O1[BEO] --> O2[Kitchen / Procurement / Logistics] --> O3[Event day] --> O4[Feedback]
  end
  subgraph FIN[Finance]
    S4 --> F1[AR / GL]
    O2 --> F2[AP / GL]
  end
  subgraph HR[People]
    H1[Recruit → Onboard → Perform → Offboard]
  end
```

**Two revenue spines:** BD **acquires** venues → Projects **readies** them → they go **LIVE** and feed the Sales pipeline → Sales books events → Event Ops **delivers** them → Finance **records** the money. HR/People staffs all of it.

---

## 1. Sales process (customer journey)

**Owner roles:** SALES_EXEC, SALES_HEAD · **Source actions:** `lead.actions`, `widget.actions`, `sales-quotation.actions`, `quotation-booking.actions`, `booking-invoice.actions`, `payment.actions`, `contract.actions`.

```mermaid
flowchart TD
  I[Inquiry: web widget / form / phone] -->|processInquiry → createLead| L1[Lead: NEW]
  L1 -->|updateLeadStatus| L2[CONTACTED]
  L2 -->|updateLeadStatus QUALIFIED| L3[QUALIFIED]
  L3 -. auto .-> PIPE[Pipeline Deal created]
  L3 -->|createSalesQuotation| Q1[Quote: DRAFT]
  Q1 -->|submitSalesQuotation| Q2[PENDING_APPROVAL]
  Q2 -->|approveSalesQuotation ⛔ approver≠submitter| Q3[APPROVED]
  Q2 -->|rejectSalesQuotation| Q1
  Q3 -->|sendSalesQuotation| Q4[SENT → Lead PROPOSAL_SENT]
  Q3 -->|blockSlotFromQuotation| B1[Booking: HOLD slot locked]
  Q3 -->|createBookingInvoiceFromQuotation| INV[Proforma Invoice: SENT<br/>20/60/20 installments]
  INV -->|recordPayment ≥20%| PAY[Payment COMPLETED]
  PAY -. maybeConfirmBookingOnPayment .-> B2[Booking: CONFIRMED]
  B2 -. auto .-> BEO[BEO auto-created → Event Ops]
  PAY -->|full payment| INVPAID[Invoice PAID = Tax Invoice]
  PAY -. after .-> GL[GL: cash receipt posted]
  B2 -->|createContract → sendContract → e-sign| C[Contract: SIGNED]
```

**Status enums (real):**
- **Lead:** `NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON | LOST`
- **Quotation:** `DRAFT → PENDING_APPROVAL → APPROVED → SENT | REJECTED(→DRAFT)`
- **Booking:** `HOLD → TENTATIVE → CONFIRMED → IN_PROGRESS → COMPLETED | CANCELLED`
- **Invoice:** `DRAFT → SENT → PARTIALLY_PAID → PAID | OVERDUE | CANCELLED`
- **Payment:** `PENDING → COMPLETED | FAILED | REFUNDED`
- **Contract:** `DRAFT → SENT → VIEWED → SIGNED | EXPIRED | CANCELLED`

**Key gates & automations:**
- Lead → QUALIFIED **auto-creates a pipeline Deal**; WON requires an assigned owner.
- Quote approval enforces **segregation of duties** (approver ≠ submitter, except SUPER_ADMIN) and **freezes a pricing snapshot** for the PDF.
- Proforma is a **20% / 60% / 20%** installment plan (advance now / 15 days before / 2 h before event).
- A **20%+ payment auto-confirms** the booking, which **auto-creates the BEO** (→ Event Ops) and spawns SOP tasks.
- Slot is locked by a unique (venue, UTC-day, time-slot) constraint → no double-booking.

---

## 2. Event Operations process (delivery)

**Owner roles:** EVENT_COORDINATOR, OPERATIONS + module teams · **Actions:** `beo.actions`, `kitchen.actions`, `procurement.actions`, `logistics.actions`, `survey.actions`, `public-feedback.actions`.

```mermaid
flowchart TD
  BK[Booking CONFIRMED] -. BOOKING_CONFIRMED workflow .-> BEO[BEO / Function Sheet<br/>DRAFT → PUBLISHED → LOCKED]
  BEO --> KIT[Kitchen Plan<br/>PLANNED → IN_PROGRESS → COMPLETED]
  BEO --> PROC[Procurement PR<br/>PENDING → APPROVED → ORDERED → RECEIVED]
  BEO --> LOG[Dispatch<br/>PLANNED → DISPATCHED → DELIVERED → RETURNED]
  PROC -. markReceived .-> GLP[GL accrual Dr Supplies / Cr AP]
  LOG -. markDispatched .-> INVDEC[Inventory decrement]
  LOG -. recordReturn/cancel .-> INVRES[Inventory restore]
  KIT --> EVT[Event day → Booking IN_PROGRESS]
  PROC --> EVT
  LOG --> EVT
  EVT --> DONE[Booking COMPLETED · BEO LOCKED]
  DONE --> SURV[Survey invite]
  DONE --> REV[Review request → gate ≥4 public / <4 private]
```

**Status enums:** BEO `DRAFT→PUBLISHED→LOCKED`; Kitchen `PLANNED→IN_PROGRESS→COMPLETED`; Procurement `PENDING→APPROVED→ORDERED→RECEIVED|REJECTED`; Dispatch `PLANNED→DISPATCHED→DELIVERED→RETURNED|CANCELLED`; Review `PENDING→SENT→RATED→ROUTED_PUBLIC|ROUTED_PRIVATE→COMPLETED`.

**Bridges & gates:**
- **Booking CONFIRMED → BEO** auto-created (idempotent); SOP task templates for all 12 event types.
- **Procurement RECEIVED → GL** accrual (Dr 5230 Supplies / Cr 2010 AP), idempotent + self-healing.
- **Dispatch → Inventory:** atomic decrement on dispatch, atomic restore on return/cancel (can't go negative).
- **Procurement approval = maker-checker** (requester ≠ approver).
- Post-event **feedback gate:** ≥4★ routes to a public Google-review link; <4★ is captured privately for staff follow-up.

---

## 3. BD / Acquisition process (winning new venues)

**Owner roles:** BD_EXECUTIVE, BD_HEAD, LEGAL · **Actions:** `acq-lead.actions`, `acq-deal.actions`, `acq-contract.actions`, `acq-meeting.actions`.

```mermaid
flowchart TD
  AL[BD Lead: NEW → CONTACTED] -->|qualifyAcqLead ⛔ 4-point gate| AD0[Deal: QUALIFIED]
  AD0 -->|submitAcqEvaluation ≥70 score| AD1[EVALUATION]
  AD1 -->|≥8 photos + pass| AD2[EVALUATION_COMPLETED]
  AD2 -->|commercials set| AD3[PROPOSAL_SENT]
  AD3 --> AD4[NEGOTIATION]
  AD4 -->|signatory verified + below-floor approval| AD5[CONTRACT_SENT]
  AD5 -->|contract SIGNED + agreement attached| AD6[SIGNED]
  AD6 -->|⛔ large-deal signoff ≥₹15L| AD7[WON]
  AD7 -. auto .-> PROP[AcqProperty + Onboarding Project + 6 seed tasks · notify OPERATIONS]
  AD6 -. post-sign .-> NOTIFY[Notify Design / Projects / Sales / Operations]
  AD7 -->|convertDealToProject + scheduleIntroductionMeeting| HANDOFF[→ Projects]
```

**Deal stage enum:** `QUALIFIED → EVALUATION → EVALUATION_COMPLETED → PROPOSAL_SENT → NEGOTIATION → CONTRACT_SENT → SIGNED → WON | LOST | ON_HOLD`.
**Contract lifecycle:** phases `AUTHORING→APPROVAL→NEGOTIATION→EXECUTION→POST_EXECUTION`; status `DRAFT→APPROVED→NEGOTIATED→SIGNED→ACTIVE→TERMINATED`.

**Approval gates:** qualification 4-point checklist; evaluation scorecard ≥70 + key fields ≥3; below-floor commercial → BD-Head approval (≠ owner); economics-freeze re-approval; **large-deal (≥₹15L) second sign-off**; signature evidence (e-sign or attached agreement) before SIGNED. **WON** auto-creates the property + onboarding project and notifies Operations; post-sign notifies all four delivery teams; **intro meetings** align Design/Projects/Sales/Operations.

---

## 4. Projects process (venue onboarding — 9 stages)

**Owner roles:** PROJECTS_EXEC, PROJECTS_HEAD, OPERATIONS · **Actions:** `projects.actions`, `project-procurement.actions`, `snags.actions`.

```mermaid
flowchart LR
  H[HANDOFF] --> A[ASSESSMENT] --> C[CAPEX] --> E[EXECUTION] --> Q[INTERNAL_QC] --> O[OPS_AUDIT] --> G[FINAL_GO_AHEAD] --> V[HANDOVER] --> L[LIVE]
  C -. gate .-> CG[CapEx APPROVED + owner approval]
  E -. gate .-> EG[All work packages DONE]
  Q -. gate .-> QG[No open CRITICAL/MAJOR snags]
  O -. gate .-> OG[All critical audit items PASS + all snags VERIFIED_CLOSED]
  V -. gate .-> VG[Handover report + Ops ack + Mgmt ack]
  L -. bridge .-> BR[Create bookable Venue · property AVAILABLE · notify Sales]
```

**Phase enum:** `HANDOFF → ASSESSMENT → CAPEX → EXECUTION → INTERNAL_QC → OPS_AUDIT → FINAL_GO_AHEAD → HANDOVER → LIVE`.
**Sub-flows:** CapEx projection (`DRAFT→PENDING_APPROVAL→APPROVED→SENT`), Work Packages (`PLANNED→IN_PROGRESS→DONE`), Purchase Orders (`DRAFT→ISSUED→RECEIVED→PAID`), Snags (`OPEN→IN_PROGRESS→FIXED_PENDING_VERIFICATION→VERIFIED_CLOSED|REOPENED`, severity CRITICAL/MAJOR/MINOR).

**Gates:** each stage advance is sign-off-recorded + audit-logged; QC blocks on open critical/major snags; Ops audit needs all critical items PASS and all snags verified-closed; **dual acknowledgement** (Ops + Mgmt) before LIVE. **LIVE atomically creates the bookable Venue** (BD→Bookings bridge) and notifies Sales to start generating bookings. Backward `reopenProject` clears later-stage stamps (cannot reopen LIVE).

---

## 5. Finance process (the money)

**Owner roles:** FINANCE, ADMIN · **Core:** `src/lib/finance/*` (double-entry GL), `payment.actions`, `payout.actions`, `commission.actions`, `finance-bank.actions`.

```mermaid
flowchart TD
  subgraph AR[Accounts Receivable]
    INV[Invoice SENT] -->|postInvoiceIssued| GL1[Dr AR / Cr Revenue + GST]
    PAY[Payment COMPLETED] -->|postPaymentReceived| GL2[Dr Bank / Cr AR or Advance]
  end
  subgraph AP[Accounts Payable]
    PR[Procurement RECEIVED] -->|postPurchaseReceivedWithinTx| GL3[Dr Supplies / Cr AP]
    PO[Payout PAID] -->|postPayoutPaid| GL4[Dr AP / Cr Bank]
  end
  GL1 & GL2 & GL3 & GL4 --> LEDGER[(General Ledger<br/>balanced, gapless FinSequence)]
  BANK[Bank CSV import] -->|autoMatch / categorize| LEDGER
  LEDGER --> RPT[Trial Balance · P&L · Balance Sheet · Cashflow · Tax · Anomalies]
  CRON[Daily self-heal reconcile] -. re-post missed entries .-> LEDGER
```

**Status enums:** Invoice (as above); Payout `PENDING→APPROVED→PAID|CANCELLED`; Commission `PENDING→APPROVED→PAID`; Journal entry `DRAFT→POSTED|REVERSED`; Bank txn `UNMATCHED→MATCHED|RECONCILED|IGNORED`.

**Controls:** integer-paise math (no float drift); **idempotent GL posting** keyed by (sourceModule, sourceRefId) → one journal entry per source doc; **daily self-healing reconcile** re-posts anything missed; **duplicate-payment control** (same vendor+amount+type within 7 days blocks); **maker-checker** on payout approval; period locking; gapless FinSequence numbering; balance invariant (Σ debits = Σ credits). Every upstream module (Sales, Procurement, Payables, Bank, Payroll) bridges into the GL.

---

## 6. HR / People process (employee lifecycle)

**Owner roles:** HR_MANAGER, HR_EXECUTIVE + reporting managers · **Actions:** `recruit*.actions`, `hr-employee.actions`, `hr-journey.actions`, `hr-leave.actions`, `hr-attendance.actions`, `hr-performance.actions`.

```mermaid
flowchart TD
  R1[Job opening] --> R2[Candidate: NEW → … → HIRED]
  R2 -->|Offer ACCEPTED| HIRE[createEmployeeFromCandidate]
  HIRE --> ON[Onboarding journey<br/>tasks + Day-1 gate]
  ON -->|completeJourney| ACT[Employee ACTIVE · login enabled]
  ACT --> ATT[Attendance: geo/IP check-in · regularization]
  ACT --> LV[Leave: apply → manager/HR approve → balance updated]
  ACT --> PERF[Performance: cycle → goals/KRA → self/manager/peer reviews → Velos points]
  ACT --> OFF[Offboarding journey → exit interview]
  OFF -->|completeJourney| EX[Employee EXITED · login revoked]
```

**Status enums:** Candidate `NEW→IN_REVIEW→AVAILABLE→ENGAGED→OFFERED→HIRED|REJECTED`; Offer `DRAFT→SENT→ACCEPTED|DECLINED|WITHDRAWN`; Journey `IN_PROGRESS→COMPLETED|CANCELLED`; Leave request `PENDING→APPROVED|REJECTED|CANCELLED`; Attendance `PRESENT|ABSENT|HALF_DAY|WFH|ON_LEAVE|…`; Appraisal cycle `DRAFT→ACTIVE→CLOSED`.

**Approval routing:** leave & regularization route **up the org chart** to the reporting manager (HR override available); **onboarding completion → activates platform login**; **offboarding completion → revokes login** + stamps exit date; performance flows feed **KRA scorecards + Velos points** (gamified incentives).

---

## Cross-cutting: RBAC, automation, audit

- **RBAC:** two systems — global `hasPermission(role, "x:read|write")` (see `src/lib/permissions.ts`) and the BD-specific `acqCan` (`src/lib/acq/rbac.ts`). Routes gated in `middleware.ts`. **VeloriaApp is a single-company ERP — staff-wide visibility within a permission is intentional, not a leak.**
- **Automation:** two cron lanes — `frequent` (SLA escalation, payment reminders, BD SLA) and `daily` (digests, GL self-heal reconcile, event auto-completion). On Vercel Hobby these run **daily**; an external scheduler can restore hourly.
- **Audit:** append-only activity/audit logs across modules; project sign-offs; finance journal entries are immutable (reversed, never deleted).

---

_This map reflects the code as deployed. For the security/correctness posture of these flows, see `docs/TEAM_AUDIT.md`._
