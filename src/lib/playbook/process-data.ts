// ============================================================
// Playbook — plain-language process maps for the whole company.
// Each process is a series of steps that anyone can read: who does it,
// what happens, what the system does automatically, and where an approval
// gate sits. Kept in business language (not code) on purpose.
// ============================================================

export type StepKind = "step" | "gate" | "auto";

export interface ProcessStep {
  /** Short stage name (sentence case). */
  title: string;
  /** Who is responsible — role/team in plain words. */
  who: string;
  /** What happens, in plain English. */
  what: string;
  /** Things the system does automatically at this step. */
  auto?: string[];
  /** If this step is an approval/quality gate, the condition to pass. */
  gate?: string;
  /** The status label the record carries after this step (optional). */
  status?: string;
}

export interface Process {
  key: string;
  name: string;
  tagline: string;
  /** Tailwind colour family used for accents. */
  accent: "violet" | "emerald" | "amber" | "blue" | "rose" | "cyan";
  icon: string; // lucide name
  handoffIn?: string;
  handoffOut?: string;
  steps: ProcessStep[];
}

// ---- The value chain (how the six processes connect) -------------------
export const VALUE_CHAIN: { name: string; sub: string; accent: Process["accent"]; icon: string }[] = [
  { name: "BD acquisition", sub: "Win new venue partners", accent: "violet", icon: "Handshake" },
  { name: "Projects", sub: "Ready the venue, take it live", accent: "amber", icon: "Briefcase" },
  { name: "Sales", sub: "Book customer events", accent: "emerald", icon: "Target" },
  { name: "Event ops", sub: "Deliver the event", accent: "blue", icon: "UtensilsCrossed" },
  { name: "Finance", sub: "Record the money", accent: "cyan", icon: "IndianRupee" },
  { name: "People / HR", sub: "Staff every process", accent: "rose", icon: "Users" },
];

export const PROCESSES: Process[] = [
  // ---------------------------------------------------------------
  {
    key: "sales",
    name: "Sales — customer booking journey",
    tagline: "From a customer enquiry to a confirmed, paid event.",
    accent: "emerald",
    icon: "Target",
    handoffOut: "A confirmed booking hands off to Event Ops.",
    steps: [
      {
        title: "Enquiry comes in",
        who: "Website / phone / walk-in",
        what: "A customer asks about a venue through the website widget, a form, WhatsApp, or a phone call.",
        auto: ["Captured as a Lead automatically", "Instant acknowledgement sent", "Assigned to a sales rep with a 15-min first-response timer"],
        status: "Lead · New",
      },
      {
        title: "Contact & qualify",
        who: "Sales executive",
        what: "The rep calls the customer, notes the event type, date, guest count and budget, and decides if it's a real opportunity.",
        status: "Lead · Contacted → Qualified",
        auto: ["A pipeline deal is created automatically when the lead is qualified"],
      },
      {
        title: "Build the quotation",
        who: "Sales executive",
        what: "Using the calculator, the rep builds a quote — per-plate food, décor, AV, seating — with taxes applied.",
        status: "Quotation · Draft",
      },
      {
        title: "Manager approval",
        who: "Sales head",
        what: "The quote is sent for approval. A manager (not the person who made it) reviews and approves the pricing.",
        gate: "Approver must be different from the person who created the quote.",
        status: "Quotation · Approved",
      },
      {
        title: "Send to customer",
        who: "Sales executive",
        what: "The approved quote PDF is sent by email or WhatsApp.",
        auto: ["Pricing is frozen into the PDF so it can't drift"],
        status: "Quotation · Sent",
      },
      {
        title: "Block the slot & raise proforma",
        who: "Sales executive",
        what: "The date/time slot is locked for the customer and a proforma invoice is raised (20% advance / 60% / 20% final).",
        auto: ["The slot is uniquely locked so it can never be double-booked"],
        status: "Booking · Hold",
      },
      {
        title: "Collect payment",
        who: "Sales / Finance",
        what: "The customer pays the advance. Each payment updates the balance and the installment plan.",
        gate: "A 20%+ advance automatically confirms the booking.",
        auto: ["Booking is confirmed", "The event order (BEO) is created for Operations", "Receipt + GL entry posted"],
        status: "Booking · Confirmed",
      },
      {
        title: "Tax invoice & contract",
        who: "Sales / Finance",
        what: "On full payment the invoice becomes the tax invoice; a contract is sent for e-signature.",
        status: "Invoice · Paid · Contract · Signed",
      },
    ],
  },

  // ---------------------------------------------------------------
  {
    key: "ops",
    name: "Event operations — delivery",
    tagline: "From a confirmed booking to a delivered event and feedback.",
    accent: "blue",
    icon: "UtensilsCrossed",
    handoffIn: "Starts the moment Sales confirms a booking.",
    steps: [
      {
        title: "Event order (BEO) created",
        who: "System → Event coordinator",
        what: "When a booking is confirmed, the Banquet Event Order (function sheet) is created with the run-of-show, menu, décor and staffing notes.",
        auto: ["Created automatically on booking confirmation", "Standard task checklist added for the event type"],
        status: "BEO · Draft → Published → Locked",
      },
      {
        title: "Kitchen & F&B plan",
        who: "Kitchen team",
        what: "The kitchen plans dishes and quantities for the guest count, and tracks estimated vs actual food cost.",
        status: "Kitchen · Planned → In progress → Completed",
      },
      {
        title: "Procurement",
        who: "Procurement team",
        what: "Items needed are requested, approved, ordered and received.",
        gate: "The person who raises a purchase request can't approve their own (maker–checker).",
        auto: ["When goods are received, a finance entry is posted automatically"],
        status: "PR · Pending → Approved → Ordered → Received",
      },
      {
        title: "Logistics & dispatch",
        who: "Logistics team",
        what: "Equipment and goods are dispatched to the venue and returned afterwards.",
        auto: ["Stock is reduced when dispatched and restored on return — it can never go negative"],
        status: "Dispatch · Planned → Dispatched → Delivered → Returned",
      },
      {
        title: "Event day",
        who: "Event coordinator + teams",
        what: "The event runs. Any issues are logged as incidents on the BEO in real time.",
        status: "Booking · In progress",
      },
      {
        title: "Wrap-up & feedback",
        who: "Event coordinator",
        what: "The event is closed, costs finalised, and the customer is invited to give feedback.",
        auto: ["Happy ratings (4★+) are routed to a public review; lower ratings are captured privately for follow-up"],
        status: "Booking · Completed",
      },
    ],
  },

  // ---------------------------------------------------------------
  {
    key: "bd",
    name: "BD acquisition — winning new venues",
    tagline: "From a hall-owner lead to a signed partnership and onboarding.",
    accent: "violet",
    icon: "Handshake",
    handoffOut: "A signed deal hands off to the Projects team.",
    steps: [
      {
        title: "Hall-owner lead",
        who: "BD executive",
        what: "A potential venue/hall owner is captured, contacted, and logged with property details.",
        status: "Lead · New → Contacted",
      },
      {
        title: "Qualify the property",
        who: "BD executive",
        what: "The owner and property are checked against the basics — capacity, interest in the management model, willingness to renovate, photos ready.",
        gate: "All four qualification points must pass to become a deal.",
        status: "Deal · Qualified",
      },
      {
        title: "Evaluate the venue",
        who: "BD executive",
        what: "A 7-point scorecard rates capacity, parking, kitchen, rooms, condition, location and AV. Photos are attached.",
        gate: "Score 70+ (with key areas strong) and 8+ photos to proceed.",
        status: "Deal · Evaluation → Completed",
      },
      {
        title: "Propose & negotiate",
        who: "BD executive / BD head",
        what: "Commercials are set (management or franchise model, fees, term) and negotiated with the owner.",
        gate: "Below-floor commercials need BD-head approval (a different person).",
        status: "Deal · Proposal → Negotiation",
      },
      {
        title: "Contract & sign",
        who: "BD head / Legal",
        what: "The contract is authored, approved, sent for e-signature and signed.",
        gate: "Large deals (₹15L+) need a second senior sign-off.",
        status: "Deal · Contract sent → Signed → Won",
      },
      {
        title: "Convert & align teams",
        who: "BD head",
        what: "The won deal becomes a property and an onboarding project; an introduction meeting aligns Design, Projects, Sales and Operations.",
        auto: ["Property + onboarding project created with starter tasks", "Design / Projects / Sales / Operations all notified"],
        status: "Property · Onboarding",
      },
    ],
  },

  // ---------------------------------------------------------------
  {
    key: "projects",
    name: "Projects — readying a venue (9 stages)",
    tagline: "From handoff to a brand-standard venue that's live and bookable.",
    accent: "amber",
    icon: "Briefcase",
    handoffIn: "Starts when BD wins a deal.",
    handoffOut: "When live, the venue feeds the Sales pipeline.",
    steps: [
      { title: "Handoff", who: "Project manager", what: "The PM accepts the won deal and the venue's master data; a readiness checklist is set up." },
      { title: "Assessment", who: "Project manager", what: "A site survey maps the gaps against Veloria Grand standards." },
      { title: "CapEx & timeline", who: "Projects head", what: "The fit-out cost and timeline are calculated, approved, and signed off by the owner.", gate: "Approved CapEx + owner approval before work starts." },
      { title: "Execution", who: "Project team + vendors", what: "Fit-out work runs as work packages with purchase orders and budget tracking.", gate: "All work packages done before quality check." },
      { title: "Internal QC", who: "Project manager", what: "An internal quality check raises and fixes snags.", gate: "No open critical/major snags to move on." },
      { title: "Ops audit", who: "Operations", what: "Operations runs a deep audit against the standard.", gate: "All critical items pass and every snag verified-closed." },
      { title: "Final go-ahead", who: "Projects head", what: "Senior sign-off that the venue is ready." },
      { title: "Handover", who: "Projects + Ops + Mgmt", what: "A handover report is produced and acknowledged by both Operations and Management.", gate: "Report + both acknowledgements required." },
      {
        title: "Live",
        who: "Projects head",
        what: "The venue goes live.",
        auto: ["A bookable venue is created automatically", "Sales is notified to start generating bookings"],
        status: "Venue · Live",
      },
    ],
  },

  // ---------------------------------------------------------------
  {
    key: "finance",
    name: "Finance — recording the money",
    tagline: "Every payment and bill flows into a proper double-entry ledger.",
    accent: "cyan",
    icon: "IndianRupee",
    handoffIn: "Fed automatically by Sales, Procurement and Payroll.",
    steps: [
      {
        title: "Money in (receivables)",
        who: "Finance",
        what: "When an invoice is sent and a payment is received, the ledger records the revenue and the cash automatically.",
        auto: ["One ledger entry per invoice/payment — never duplicated", "A daily self-heal re-posts anything missed"],
      },
      {
        title: "Money out (payables)",
        who: "Finance",
        what: "Vendor bills and payouts are created, approved, and paid — each posting to the ledger.",
        gate: "Payout approver must differ from the creator; duplicate payments are blocked.",
      },
      {
        title: "Commissions & payouts",
        who: "Finance",
        what: "Sales commissions and owner payouts are calculated and paid out.",
      },
      {
        title: "Bank reconciliation",
        who: "Finance",
        what: "Bank statements are imported and matched to ledger entries; unmatched lines are categorised.",
        auto: ["Learns categorisation rules over time", "Duplicate statement lines are skipped"],
      },
      {
        title: "Reports",
        who: "Finance / Management",
        what: "Trial Balance, P&L, Balance Sheet, cashflow and tax reports are produced from the ledger, with anomaly flags.",
      },
    ],
  },

  // ---------------------------------------------------------------
  {
    key: "hr",
    name: "People / HR — employee lifecycle",
    tagline: "From hiring to onboarding, daily work, growth and exit.",
    accent: "rose",
    icon: "Users",
    steps: [
      { title: "Recruit", who: "HR", what: "Job openings are posted, candidates move through the pipeline, interviews happen and an offer is made." },
      {
        title: "Hire & onboard",
        who: "HR",
        what: "An accepted offer becomes an employee and an onboarding checklist runs.",
        auto: ["Finishing onboarding activates the person's app login"],
        status: "Employee · Onboarding → Active",
      },
      { title: "Attendance & leave", who: "Employee + manager", what: "Staff check in (location/IP verified), and leave requests are approved up the org chart." },
      { title: "Performance", who: "Manager + HR", what: "Goals/KRAs are set and reviewed; recognition and Velos points reward good work." },
      {
        title: "Offboard",
        who: "HR",
        what: "On exit, a clearance checklist runs and an exit interview is captured.",
        auto: ["Finishing offboarding revokes the person's app access immediately"],
        status: "Employee · Exited",
      },
    ],
  },
];
