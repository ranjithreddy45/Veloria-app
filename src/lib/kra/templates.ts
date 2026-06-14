// ============================================================
// KRA monthly scorecard templates — Veloria Grand sales roles.
// Source of truth = the three KRA v3 docs (BDM / Corporate Sales /
// Inside Sales). Each KPI is scored either AUTO (computed from CRM data via
// `autoKey`, see auto-metrics.ts) or MANUAL (manager enters a band/value).
// Pure data + a couple of helpers — no DB, no "use server".
// ============================================================

export type KraRole = "BDM" | "CORPORATE_SALES" | "INSIDE_SALES";
export const KRA_ROLES: KraRole[] = ["BDM", "CORPORATE_SALES", "INSIDE_SALES"];

// How a KPI turns a raw value into points.
export type KraScoreSpec =
  // descending numeric tiers: first tier whose `gte` the value meets wins.
  | { kind: "numericTiers"; unit: "INR" | "COUNT" | "PCT"; tiers: { gte: number; points: number }[] }
  // manager picks a band; each band carries its own points.
  | { kind: "manualBands"; bands: { value: string; label: string; points: number }[] };

export type KraKpi = {
  ref: string;            // "A1"
  name: string;
  metric: string;         // what it measures
  target: string;         // human target label
  maxPoints: number;
  source: "AUTO" | "MANUAL";
  autoKey?: string;       // key into resolveAutoMetrics() output (AUTO only)
  autoUnit?: "INR" | "COUNT" | "PCT";
  score: KraScoreSpec;
  note?: string;
};

export type KraSection = { ref: string; title: string; focus: string; maxPoints: number; kpis: KraKpi[] };

export type KraBand = { minScore: number; grade: string; level: string; basePct: number; remark: string };

export type KraGateMetric = { key: string; label: string; unit: "INR" | "COUNT" | "PCT" };

export type KraTemplate = {
  role: KraRole;
  title: string;
  department: string;
  reportingTo: string;
  primaryFocus: string;
  monthlyTargetLabel: string;
  sections: KraSection[];
  // Gate: ALL `requires` must pass (with the ramped threshold for new hires).
  gate: {
    description: string;
    requires: {
      key: string;            // metric key (auto or manual) the gate reads
      label: string;
      unit: "INR" | "COUNT" | "PCT";
      full: number;           // month 3+ threshold
      ramp: [number, number]; // [month1, month2] thresholds
    }[];
  };
  bands: KraBand[];
  // BDM only: deal-quality multiplier on the final payout.
  multiplier?: { manualKey: string; options: { value: string; label: string; factor: number }[] };
};

// Standard performance bands (BDM doc). Sales docs use the same grade cutoffs;
// their monetary payout is gate + revenue slab (shown as reference in the UI).
const STANDARD_BANDS: KraBand[] = [
  { minScore: 90, grade: "A+", level: "Exceptional", basePct: 100, remark: "Star performer + fast-track review" },
  { minScore: 75, grade: "A", level: "Exceeds Expectations", basePct: 85, remark: "Strong performer" },
  { minScore: 60, grade: "B", level: "Meets Expectations", basePct: 65, remark: "On track" },
  { minScore: 45, grade: "C", level: "Below Expectations", basePct: 0, remark: "PIP discussion initiated" },
  { minScore: 0, grade: "D", level: "Unsatisfactory", basePct: 0, remark: "Formal review & corrective action" },
];

const L = (n: number) => n * 100000; // lakhs → rupees

// ============================================================
// BDM — Property Acquisition (gate = 3 signings; quality multiplier)
// ============================================================
const BDM: KraTemplate = {
  role: "BDM",
  title: "Business Development Manager",
  department: "Property Acquisition",
  reportingTo: "GM / Director",
  primaryFocus: "Property acquisition",
  monthlyTargetLabel: "3 property signings / month",
  sections: [
    {
      ref: "A", title: "Property Signings & Deal Quality", focus: "OUTCOME", maxPoints: 30,
      kpis: [
        {
          ref: "A1", name: "Properties Signed", metric: "Fully executed agreements + internal approvals.", target: "3 / month",
          maxPoints: 20, source: "AUTO", autoKey: "bdm_signings", autoUnit: "COUNT",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 3, points: 20 }, { gte: 2, points: 13 }, { gte: 1, points: 6 }, { gte: 0, points: 0 }] },
          note: "Also the incentive GATE.",
        },
        {
          ref: "A2", name: "Deal Quality Index", metric: "Mgmt fee %, lock-in, projected GMV vs benchmark.", target: "Meet/exceed benchmark",
          maxPoints: 10, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ABOVE", label: "All deals at/above benchmark", points: 10 },
            { value: "ONE_BELOW", label: "Mostly at benchmark, 1 below", points: 7 },
            { value: "MIXED", label: "Mixed / mostly below benchmark", points: 4 },
            { value: "SUBFLOOR", label: "Signed on sub-floor terms", points: 0 },
          ] },
          note: "Benchmark set by Director per quarter. Drives the quality multiplier.",
        },
      ],
    },
    {
      ref: "B", title: "Prospecting Activity", focus: "PIPELINE", maxPoints: 22,
      kpis: [
        { ref: "B1", name: "Owner / Landlord Outreach Calls", metric: "Cold/warm/referral calls to owners.", target: "≈260 / month", maxPoints: 9, source: "AUTO", autoKey: "bdm_owner_calls", autoUnit: "COUNT",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 260, points: 9 }, { gte: 200, points: 6 }, { gte: 140, points: 3 }, { gte: 0, points: 0 }] } },
        { ref: "B2", name: "Owner Meetings / Negotiations", metric: "Face-to-face / virtual owner meetings.", target: "12 / month", maxPoints: 7, source: "MANUAL",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 12, points: 7 }, { gte: 9, points: 5 }, { gte: 5, points: 3 }, { gte: 0, points: 0 }] },
          note: "Not distinctly logged as a channel — manager enters the count." },
        { ref: "B3", name: "Property Site Visits", metric: "Physical visits to evaluate suitability.", target: "12 / month", maxPoints: 6, source: "AUTO", autoKey: "bdm_site_visits", autoUnit: "COUNT",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 12, points: 6 }, { gte: 9, points: 4 }, { gte: 5, points: 2 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "C", title: "Forward Pipeline Health & Coverage", focus: "PIPELINE", maxPoints: 13,
      kpis: [
        { ref: "C1", name: "Qualified Pipeline at Month-End", metric: "Deals at LOI/MOU/negotiation carried forward.", target: "≥5 qualified deals", maxPoints: 7, source: "AUTO", autoKey: "bdm_qualified_pipeline", autoUnit: "COUNT",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 5, points: 7 }, { gte: 3, points: 4 }, { gte: 1, points: 2 }, { gte: 0, points: 0 }] } },
        { ref: "C2", name: "Next-Month Coverage", metric: "Next month's 3 signings already covered by ≥LOI deals.", target: "3 deals covered", maxPoints: 6, source: "MANUAL",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 3, points: 6 }, { gte: 2, points: 4 }, { gte: 1, points: 2 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "D", title: "Document Collection & Legal Compliance", focus: "LEGAL", maxPoints: 20,
      kpis: [
        { ref: "D1", name: "Property Document Completeness", metric: "Title, Khata, EC, tax, NOC, ID, bank, utilities.", target: "100% per property", maxPoints: 8, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "FULL", label: "100% before signing", points: 8 },
            { value: "ONE_NONCRIT", label: "1 non-critical doc pending", points: 6 },
            { value: "TWO_THREE", label: "2–3 docs pending", points: 3 },
            { value: "CRITICAL_MISSING", label: "Critical doc (title/Khata) missing", points: 0 },
          ] } },
        { ref: "D2", name: "Legal Agreement Adherence", metric: "MOU/LOI, stamp duty, witnesses, registration, clauses.", target: "Zero legal gaps", maxPoints: 8, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "CLEAN", label: "All checklist items met", points: 8 },
            { value: "ONE_MINOR", label: "1 minor gap, corrected", points: 5 },
            { value: "TWO_REWORK", label: "2 gaps requiring rework", points: 2 },
            { value: "MATERIAL", label: "Material gap / invalid execution", points: 0 },
          ] } },
        { ref: "D3", name: "Submission Timeliness", metric: "Docs + agreement to legal/ops within SLA of signing.", target: "Within 3 working days", maxPoints: 4, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ON_TIME", label: "Within 3 working days", points: 4 },
            { value: "SLIGHT", label: "3–5 working days", points: 2 },
            { value: "LATE", label: "Beyond 5 working days", points: 0 },
          ] } },
      ],
    },
    {
      ref: "E", title: "Coordination, Handholding & Go-Live", focus: "EXECUTION", maxPoints: 15,
      kpis: [
        { ref: "E1", name: "Cross-Functional Handoff & Escalation", metric: "Brief Legal/Ops/Accounts/Design; flag issues.", target: "Handoff within 48 hrs", maxPoints: 6, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "CLEAN", label: "Handoff + clean escalation", points: 6 },
            { value: "W72", label: "Handoff within 72 hrs", points: 4 },
            { value: "LATE_FLAGGED", label: "Late handoff but issues flagged", points: 2 },
            { value: "HIDDEN", label: "Delayed/incomplete + issues hidden", points: 0 },
          ] } },
        { ref: "E2", name: "Landlord Engagement to Go-Live", metric: "Check-ins signing→go-live; manage owner concerns.", target: "No owner-side dispute", maxPoints: 5, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "NO_DISPUTE", label: "Consistent contact, no dispute", points: 5 },
            { value: "ONE_RESOLVED", label: "1 minor concern, resolved", points: 3 },
            { value: "GAPS", label: "Contact gaps / complaint raised", points: 1 },
            { value: "DISPUTE", label: "Owner dispute or withdrawal", points: 0 },
          ] } },
        { ref: "E3", name: "Go-Live on Committed Date", metric: "Operational by committed date (owner-side items only).", target: "On/before committed date", maxPoints: 4, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ON_TIME", label: "On or before committed date", points: 4 },
            { value: "BDM_DELAY", label: "Delay 1–7 days, BDM-driven", points: 2 },
            { value: "BDM_INACTION", label: "Delay 8+ days due to BDM inaction", points: 0 },
          ] } },
      ],
    },
  ],
  gate: {
    description: "≥3 confirmed property signings in the month unlocks any incentive (ramp: M1=1, M2=2, M3+=3).",
    requires: [{ key: "bdm_signings", label: "Property signings", unit: "COUNT", full: 3, ramp: [1, 2] }],
  },
  bands: STANDARD_BANDS,
  multiplier: {
    manualKey: "A2", // deal-quality band
    options: [
      { value: "ABOVE", label: "All deals above benchmark", factor: 1.1 },
      { value: "ONE_BELOW", label: "At benchmark", factor: 1.0 },
      { value: "MIXED", label: "Mostly below benchmark", factor: 0.9 },
      { value: "SUBFLOOR", label: "Sub-floor terms", factor: 0.9 },
    ],
  },
};

// ============================================================
// CORPORATE SALES — field hunting (gate = ₹30L + 15 bookings + 100% payment)
// ============================================================
const CORPORATE_SALES: KraTemplate = {
  role: "CORPORATE_SALES",
  title: "Corporate Sales Executive",
  department: "Corporate Sales",
  reportingTo: "Sales Head / GM",
  primaryFocus: "Field hunting — corporates",
  monthlyTargetLabel: "₹30L revenue · 15 bookings / month",
  sections: [
    {
      ref: "A", title: "Revenue Generation — Bookings & Closings", focus: "PRIMARY", maxPoints: 40,
      kpis: [
        { ref: "A1", name: "Total Corporate Revenue", metric: "All confirmed corporate bookings this month.", target: "₹30L / month", maxPoints: 25, source: "AUTO", autoKey: "revenue", autoUnit: "INR",
          score: { kind: "numericTiers", unit: "INR", tiers: [{ gte: L(30), points: 25 }, { gte: L(24), points: 20 }, { gte: L(18), points: 14 }, { gte: L(12), points: 8 }, { gte: 0, points: 0 }] } },
        { ref: "A2", name: "Confirmed Bookings (count + ticket)", metric: "≥15 signed AND avg ticket ≥₹1.8L.", target: "15 @ ≥₹1.8L", maxPoints: 10, source: "MANUAL", autoKey: "bookings_count", autoUnit: "COUNT",
          score: { kind: "manualBands", bands: [
            { value: "FULL", label: "15+ & avg ≥₹1.8L", points: 10 },
            { value: "MID_TICKET", label: "15+, avg ₹1.4–1.79L", points: 7 },
            { value: "B12_14", label: "12–14 bookings", points: 5 },
            { value: "B10_11", label: "10–11 bookings", points: 2 },
            { value: "BELOW", label: "Below 10", points: 0 },
          ] },
          note: "Auto-fills booking count + avg ticket; manager confirms the band." },
        { ref: "A3", name: "Payment Collection — 3-Stage", metric: "20% booking + 60% T-15d + 20% T-2h.", target: "100% before every event", maxPoints: 5, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL_ON_TIME", label: "All 3 stages on time", points: 5 },
            { value: "ONE_RECOVERED", label: "1 delay, recovered", points: 3 },
            { value: "TWO_PLUS", label: "2+ delays", points: 1 },
            { value: "BALANCE", label: "Any event with balance", points: 0 },
          ], }, note: "Accounts sign-off per event." },
      ],
    },
    {
      ref: "B", title: "Field Activity — Calls, Visits & Pitches", focus: "PIPELINE", maxPoints: 25,
      kpis: [
        { ref: "B1", name: "Outbound Calls to Decision-Makers", metric: "Cold/warm/referral calls to DMs.", target: "≈330 / month", maxPoints: 8, source: "AUTO", autoKey: "outbound_calls", autoUnit: "COUNT",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 330, points: 8 }, { gte: 260, points: 6 }, { gte: 190, points: 3 }, { gte: 0, points: 0 }] } },
        { ref: "B2", name: "Corporate Meetings / Office Visits", metric: "In-person/video meetings.", target: "16 / month", maxPoints: 9, source: "AUTO", autoKey: "meetings", autoUnit: "COUNT",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 16, points: 9 }, { gte: 12, points: 6 }, { gte: 8, points: 3 }, { gte: 0, points: 0 }] } },
        { ref: "B3", name: "Site Visits / Venue Presentations", metric: "Bringing clients to Veloria for a walkthrough.", target: "6 / month", maxPoints: 8, source: "MANUAL",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 8, points: 8 }, { gte: 6, points: 5 }, { gte: 4, points: 2 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "C", title: "Pipeline Quality & Account Management", focus: "QUALITY", maxPoints: 20,
      kpis: [
        { ref: "C1", name: "Active Qualified Pipeline Value", metric: "Deals with meeting held + next step.", target: "₹60L+", maxPoints: 6, source: "AUTO", autoKey: "pipeline_value", autoUnit: "INR",
          score: { kind: "numericTiers", unit: "INR", tiers: [{ gte: L(80), points: 6 }, { gte: L(60), points: 4 }, { gte: L(40), points: 2 }, { gte: 0, points: 0 }] } },
        { ref: "C2", name: "New Corporate Accounts Opened", metric: "Net-new accounts with full contact + meeting.", target: "8 new / month", maxPoints: 5, source: "AUTO", autoKey: "new_accounts", autoUnit: "COUNT",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 12, points: 5 }, { gte: 8, points: 3 }, { gte: 5, points: 1 }, { gte: 0, points: 0 }] } },
        { ref: "C3", name: "Repeat Business & Retention", metric: "Clients who rebook / multi-event.", target: "1 repeat / month", maxPoints: 5, source: "MANUAL",
          score: { kind: "numericTiers", unit: "COUNT", tiers: [{ gte: 3, points: 5 }, { gte: 2, points: 3 }, { gte: 1, points: 2 }, { gte: 0, points: 0 }] } },
        { ref: "C4", name: "Forecast Accuracy", metric: "Predicted-to-close deals that actually close.", target: "≥60%", maxPoints: 4, source: "MANUAL",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 75, points: 4 }, { gte: 60, points: 2 }, { gte: 45, points: 1 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "D", title: "Proposal, Upsell & Deal Value", focus: "REVENUE MIX", maxPoints: 10,
      kpis: [
        { ref: "D1", name: "Proposal Conversion Rate", metric: "Proposals sent vs confirmed bookings.", target: "≥35%", maxPoints: 5, source: "AUTO", autoKey: "proposal_conversion", autoUnit: "PCT",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 50, points: 5 }, { gte: 35, points: 3 }, { gte: 25, points: 1 }, { gte: 0, points: 0 }] } },
        { ref: "D2", name: "Upsell Attachment Rate", metric: "% of bookings with ≥1 paid add-on.", target: "≥40%", maxPoints: 5, source: "MANUAL",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 60, points: 5 }, { gte: 40, points: 3 }, { gte: 25, points: 1 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "E", title: "Reporting, CRM & Conduct", focus: "COMPLIANCE", maxPoints: 5,
      kpis: [
        { ref: "E1", name: "CRM Update Compliance", metric: "All meetings/calls/proposals logged same day.", target: "100% daily", maxPoints: 3, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL", label: "All days", points: 3 },
            { value: "MISS_1_3", label: "Miss 1–3 days", points: 1 },
            { value: "MISS_4", label: "Miss 4+", points: 0 },
          ] } },
        { ref: "E2", name: "Weekly Report & Review Attendance", metric: "Monday report + present at review.", target: "4 reports + 4 meetings", maxPoints: 2, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL", label: "All 4 + all meetings", points: 2 },
            { value: "THREE", label: "3 of 4", points: 1 },
            { value: "BELOW", label: "2 or below", points: 0 },
          ] } },
      ],
    },
  ],
  gate: {
    description: "₹30L revenue AND 15 bookings AND 100% pre-event payment (ramp: M1=₹15L/8, M2=₹22.5L/12).",
    requires: [
      { key: "revenue", label: "Confirmed revenue", unit: "INR", full: L(30), ramp: [L(15), L(22.5)] },
      { key: "bookings_count", label: "Confirmed bookings", unit: "COUNT", full: 15, ramp: [8, 12] },
      { key: "payment_full_pct", label: "Pre-event payment collected", unit: "PCT", full: 100, ramp: [100, 100] },
    ],
  },
  bands: STANDARD_BANDS,
};

// ============================================================
// INSIDE SALES — inbound conversion (gate = ₹30L + 22 bookings + 100% payment)
// ============================================================
const INSIDE_SALES: KraTemplate = {
  role: "INSIDE_SALES",
  title: "Inside Sales Executive",
  department: "Inside Sales",
  reportingTo: "Sales Head / GM",
  primaryFocus: "Inbound enquiry conversion",
  monthlyTargetLabel: "₹30L revenue · 22 bookings / month",
  sections: [
    {
      ref: "A", title: "Revenue Generation — Confirmed Bookings", focus: "PRIMARY", maxPoints: 35,
      kpis: [
        { ref: "A1", name: "Total Revenue from Inbound Bookings", metric: "All signed agreements from inbound this month.", target: "₹30L / month", maxPoints: 22, source: "AUTO", autoKey: "revenue", autoUnit: "INR",
          score: { kind: "numericTiers", unit: "INR", tiers: [{ gte: L(30), points: 22 }, { gte: L(24), points: 18 }, { gte: L(18), points: 12 }, { gte: L(12), points: 7 }, { gte: 0, points: 0 }] } },
        { ref: "A2", name: "Confirmed Bookings (count + ticket)", metric: "≥22 signed AND avg ticket ≥₹1.2L.", target: "22 @ ≥₹1.2L", maxPoints: 8, source: "MANUAL", autoKey: "bookings_count", autoUnit: "COUNT",
          score: { kind: "manualBands", bands: [
            { value: "FULL", label: "22+ & avg ≥₹1.2L", points: 8 },
            { value: "MID_TICKET", label: "22+, avg ₹95K–1.19L", points: 6 },
            { value: "B18_21", label: "18–21 bookings", points: 4 },
            { value: "B14_17", label: "14–17 bookings", points: 2 },
            { value: "BELOW", label: "Below 14", points: 0 },
          ] }, note: "Auto-fills count + avg ticket; manager confirms the band." },
        { ref: "A3", name: "Payment Collection — 3-Stage", metric: "20% + 60% (T-15d) + 20% (T-2h).", target: "100% before every event", maxPoints: 5, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL_ON_TIME", label: "All 3 stages on time", points: 5 },
            { value: "ONE_RECOVERED", label: "1 delay, recovered", points: 3 },
            { value: "TWO_PLUS", label: "2+ delays", points: 1 },
            { value: "BALANCE", label: "Any event with balance", points: 0 },
          ] }, note: "Accounts sign-off; no self-reporting." },
      ],
    },
    {
      ref: "B", title: "Enquiry Handling — Speed, Quality & Volume", focus: "FUNNEL TOP", maxPoints: 25,
      kpis: [
        { ref: "B1", name: "First Response Time", metric: "Enquiry → first meaningful response within SLA.", target: "15 min calls / 1 hr email-WA", maxPoints: 8, source: "AUTO", autoKey: "first_response_sla_pct", autoUnit: "PCT",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 100, points: 8 }, { gte: 90, points: 5 }, { gte: 75, points: 2 }, { gte: 0, points: 0 }] } },
        { ref: "B2", name: "Enquiry Qualification Score", metric: "Event type, date, pax, budget, timeline captured.", target: "100% qualified", maxPoints: 7, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL5", label: "All 5 fields, every enquiry", points: 7 },
            { value: "AVG4", label: "4 fields avg", points: 5 },
            { value: "AVG3", label: "3 fields avg", points: 2 },
            { value: "BELOW", label: "Below 3 avg", points: 0 },
          ] } },
        { ref: "B3", name: "Enquiry Volume Logged", metric: "All inbound enquiries logged in CRM.", target: "100% ≤30 min", maxPoints: 6, source: "MANUAL",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 100, points: 6 }, { gte: 90, points: 4 }, { gte: 75, points: 2 }, { gte: 0, points: 0 }] },
          note: "Compliance % can't be auto-measured (unlogged enquiries are invisible) — manager enters." },
        { ref: "B4", name: "Follow-up Cadence", metric: "Every open enquiry followed up within 24 hrs.", target: "100% ≤24 hrs", maxPoints: 4, source: "MANUAL",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 100, points: 4 }, { gte: 85, points: 2 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "C", title: "Conversion — Site Visits & Proposal Closing", focus: "CONVERSION", maxPoints: 20,
      kpis: [
        { ref: "C1", name: "Enquiry → Site Visit Rate", metric: "% of qualified enquiries → confirmed visit.", target: "≥40%", maxPoints: 7, source: "MANUAL",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 55, points: 7 }, { gte: 40, points: 5 }, { gte: 25, points: 2 }, { gte: 0, points: 0 }] } },
        { ref: "C2", name: "Site Visit → Proposal Rate", metric: "% of visits with a proposal within 24 hrs.", target: "100% ≤24 hrs", maxPoints: 7, source: "MANUAL",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 100, points: 7 }, { gte: 85, points: 5 }, { gte: 70, points: 2 }, { gte: 0, points: 0 }] } },
        { ref: "C3", name: "Proposal → Booking Rate", metric: "% of proposals that convert to bookings.", target: "≥45%", maxPoints: 6, source: "AUTO", autoKey: "proposal_conversion", autoUnit: "PCT",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 60, points: 6 }, { gte: 45, points: 4 }, { gte: 30, points: 2 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "D", title: "Upsell, Package Attachment & Revenue Quality", focus: "REVENUE MIX", maxPoints: 10,
      kpis: [
        { ref: "D1", name: "Upsell Attachment Rate", metric: "% of bookings with ≥1 paid add-on.", target: "≥50%", maxPoints: 5, source: "MANUAL",
          score: { kind: "numericTiers", unit: "PCT", tiers: [{ gte: 70, points: 5 }, { gte: 50, points: 3 }, { gte: 30, points: 1 }, { gte: 0, points: 0 }] } },
        { ref: "D2", name: "Average Booking Value", metric: "Avg revenue per booking vs ₹1.35L benchmark.", target: "≥₹1.35L", maxPoints: 5, source: "AUTO", autoKey: "avg_ticket", autoUnit: "INR",
          score: { kind: "numericTiers", unit: "INR", tiers: [{ gte: L(1.6), points: 5 }, { gte: L(1.35), points: 3 }, { gte: L(1), points: 1 }, { gte: 0, points: 0 }] } },
      ],
    },
    {
      ref: "E", title: "CRM, Reporting, Follow-up & Conduct", focus: "COMPLIANCE", maxPoints: 10,
      kpis: [
        { ref: "E1", name: "CRM Data Quality & Daily Updates", metric: "All enquiries/notes/visits/proposals logged same day.", target: "100% same-day", maxPoints: 4, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL", label: "Every day, zero gaps", points: 4 },
            { value: "MISS_1_3", label: "Miss 1–3 days", points: 2 },
            { value: "MISS_4", label: "Miss 4+ or gaps", points: 0 },
          ] } },
        { ref: "E2", name: "Weekly Report & Review Attendance", metric: "Monday funnel report + present at review.", target: "4 reports + 4 meetings", maxPoints: 3, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL", label: "All 4 + all meetings", points: 3 },
            { value: "THREE", label: "3 of 4", points: 2 },
            { value: "BELOW", label: "2 or below", points: 0 },
          ] } },
        { ref: "E3", name: "Post-Event Follow-up & Reviews", metric: "Follow up 2 days post-event for feedback + review.", target: "100% of events", maxPoints: 3, source: "MANUAL",
          score: { kind: "manualBands", bands: [
            { value: "ALL_HIGH", label: "100% + avg rating ≥4.5", points: 3 },
            { value: "MOST", label: "80–99%", points: 2 },
            { value: "BELOW", label: "Below 80%", points: 0 },
          ] } },
      ],
    },
  ],
  gate: {
    description: "₹30L revenue AND 22 bookings AND 100% pre-event payment (ramp: M1=₹15L/11, M2=₹22.5L/16).",
    requires: [
      { key: "revenue", label: "Confirmed revenue", unit: "INR", full: L(30), ramp: [L(15), L(22.5)] },
      { key: "bookings_count", label: "Confirmed bookings", unit: "COUNT", full: 22, ramp: [11, 16] },
      { key: "payment_full_pct", label: "Pre-event payment collected", unit: "PCT", full: 100, ramp: [100, 100] },
    ],
  },
  bands: STANDARD_BANDS,
};

export const KRA_TEMPLATES: Record<KraRole, KraTemplate> = {
  BDM,
  CORPORATE_SALES,
  INSIDE_SALES,
};

export const KRA_ROLE_LABEL: Record<KraRole, string> = {
  BDM: "Business Development Manager",
  CORPORATE_SALES: "Corporate Sales Executive",
  INSIDE_SALES: "Inside Sales Executive",
};

export function getKraTemplate(role: string): KraTemplate | null {
  return (KRA_TEMPLATES as Record<string, KraTemplate>)[role] ?? null;
}

// Flat list of every KPI in a template (handy for iteration).
export function allKpis(t: KraTemplate): KraKpi[] {
  return t.sections.flatMap((s) => s.kpis);
}
