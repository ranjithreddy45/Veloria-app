/**
 * Idempotent template seeding — SOP (ops checklist) templates + email
 * templates for an Indian banquet/event business. Called from bootstrap.ts,
 * so it runs on every deploy and only creates what's missing (matched by
 * name). Never deletes or overwrites, so manual edits in the app are safe.
 *
 * SOP templates power the ops auto-task feature: when a booking is confirmed
 * (advance paid), the best-matching template (by eventType, then the default)
 * is stamped into a live ExecutionPlan with phases + tasks.
 */
import type { PrismaClient } from "@prisma/client";

type Phase = "PRE_EVENT" | "SETUP" | "GUEST_ARRIVAL" | "LIVE_EVENT" | "WRAP_UP" | "HANDOVER";
type Category =
  | "DECOR" | "AV" | "CATERING" | "HOUSEKEEPING" | "GUEST_SEATING"
  | "ENTERTAINMENT" | "LOGISTICS" | "SECURITY" | "GENERAL";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface TaskDef {
  title: string;
  category: Category;
  priority?: Priority;
  estimatedMinutes?: number;
  mandatory?: boolean;
  proof?: boolean;
  approval?: boolean;
  description?: string;
}
interface PhaseDef {
  name: string;
  phase: Phase;
  tasks: TaskDef[];
}
interface SOPDef {
  name: string;
  eventType: string | null;
  isDefault?: boolean;
  description: string;
  phases: PhaseDef[];
}

// ---- Shared building blocks reused across event types ----
const PRE_EVENT_COMMON: TaskDef[] = [
  { title: "Confirm final guest count with host", category: "GENERAL", priority: "HIGH", mandatory: true, estimatedMinutes: 30 },
  { title: "Lock menu & per-plate count with kitchen", category: "CATERING", priority: "HIGH", mandatory: true, estimatedMinutes: 45 },
  { title: "Confirm dietary needs (Jain/veg/allergy) with kitchen", category: "CATERING", priority: "MEDIUM", estimatedMinutes: 20 },
  { title: "Confirm all vendors (caterer, decor, photographer, DJ)", category: "LOGISTICS", priority: "HIGH", mandatory: true, estimatedMinutes: 60 },
  { title: "Verify balance payment status before event day", category: "GENERAL", priority: "HIGH", mandatory: true, estimatedMinutes: 15 },
  { title: "Circulate final run-sheet (BEO) to ops team", category: "GENERAL", priority: "HIGH", mandatory: true, estimatedMinutes: 30 },
  { title: "Finalise floor plan & seating chart", category: "GUEST_SEATING", priority: "HIGH", estimatedMinutes: 30 },
  { title: "Assign staffing roster & shift timings", category: "GENERAL", priority: "HIGH", estimatedMinutes: 30 },
  { title: "Confirm power load & generator backup readiness", category: "AV", priority: "HIGH", mandatory: true, estimatedMinutes: 20 },
  { title: "Confirm parking / valet capacity vs guest count", category: "LOGISTICS", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Brief security on guest count, VIPs & access points", category: "SECURITY", priority: "MEDIUM", estimatedMinutes: 20 },
];
const SETUP_COMMON: TaskDef[] = [
  { title: "Deep-clean & sanitize the hall", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, estimatedMinutes: 90 },
  { title: "Lay tables & chairs per floor plan", category: "GUEST_SEATING", priority: "HIGH", estimatedMinutes: 60 },
  { title: "AV check — mics, speakers, projector", category: "AV", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 45 },
  { title: "Lighting setup & test", category: "AV", priority: "MEDIUM", estimatedMinutes: 30 },
  { title: "Generator / power backup test", category: "AV", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 20 },
  { title: "Air-conditioning on & temperature set", category: "HOUSEKEEPING", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Buffet / live counters setup", category: "CATERING", priority: "HIGH", estimatedMinutes: 60 },
  { title: "Restrooms stocked, clean & signed", category: "HOUSEKEEPING", priority: "MEDIUM", estimatedMinutes: 30 },
  { title: "Fire exits clear & extinguishers checked", category: "SECURITY", priority: "HIGH", mandatory: true, estimatedMinutes: 15 },
  { title: "Welcome signage & directions placed", category: "LOGISTICS", priority: "LOW", estimatedMinutes: 20 },
  { title: "Ops walkthrough vs BEO before doors open", category: "GENERAL", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 30 },
];
const ARRIVAL_COMMON: TaskDef[] = [
  { title: "Reception desk & guest list ready", category: "GUEST_SEATING", priority: "HIGH", estimatedMinutes: 20 },
  { title: "Welcome drinks ready at entrance", category: "CATERING", priority: "MEDIUM", estimatedMinutes: 20 },
  { title: "Valet & parking coordination", category: "LOGISTICS", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Brief ushers & security on guest flow", category: "SECURITY", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Gift / return-favour counter ready", category: "GUEST_SEATING", priority: "LOW", estimatedMinutes: 15 },
];
const WRAP_COMMON: TaskDef[] = [
  { title: "Collect host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true, estimatedMinutes: 15 },
  { title: "Vendor settlement & sign-off checklist", category: "LOGISTICS", priority: "HIGH", estimatedMinutes: 30 },
  { title: "Return rented equipment & reconcile inventory", category: "LOGISTICS", priority: "MEDIUM", estimatedMinutes: 30 },
  { title: "Staff headcount reconciliation & overtime log", category: "GENERAL", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Confirm photographer / videographer deliverables & timeline", category: "GENERAL", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Lost & found collection", category: "GENERAL", priority: "LOW", estimatedMinutes: 10 },
];
const HANDOVER_COMMON: TaskDef[] = [
  { title: "Hall handover & damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 30 },
  { title: "Log any snags / damage for follow-up", category: "GENERAL", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Final settlement & invoice closure", category: "GENERAL", priority: "HIGH", approval: true, estimatedMinutes: 20 },
  { title: "Trigger post-event feedback survey to host", category: "GENERAL", priority: "MEDIUM", estimatedMinutes: 10 },
  { title: "Post-event report & photos archived", category: "GENERAL", priority: "LOW", estimatedMinutes: 20 },
];

// Generic "during the event" coverage, shared by all templates.
const LIVE_COMMON: TaskDef[] = [
  { title: "Food & beverage service per timeline", category: "CATERING", priority: "HIGH", mandatory: true },
  { title: "Monitor AC, cleanliness & restrooms through the event", category: "HOUSEKEEPING", priority: "MEDIUM" },
  { title: "Coordinate program / MC cues with host", category: "ENTERTAINMENT", priority: "MEDIUM" },
  { title: "Photography / videography coverage", category: "GENERAL", priority: "MEDIUM" },
  { title: "Floor manager on-call for host requests", category: "GENERAL", priority: "MEDIUM" },
];

// Compose a template from the shared blocks + per-phase event-specific tasks.
type Specifics = Partial<Record<Phase, TaskDef[]>>;
function sop(name: string, eventType: string | null, description: string, s: Specifics = {}, isDefault = false): SOPDef {
  return {
    name, eventType, isDefault, description,
    phases: [
      { name: "Pre-Event Preparation", phase: "PRE_EVENT", tasks: [...PRE_EVENT_COMMON, ...(s.PRE_EVENT ?? [])] },
      { name: "Venue Setup", phase: "SETUP", tasks: [...SETUP_COMMON, ...(s.SETUP ?? [])] },
      { name: "Guest Arrival", phase: "GUEST_ARRIVAL", tasks: [...ARRIVAL_COMMON, ...(s.GUEST_ARRIVAL ?? [])] },
      { name: "During the Event", phase: "LIVE_EVENT", tasks: [...LIVE_COMMON, ...(s.LIVE_EVENT ?? [])] },
      { name: "Wind-Down", phase: "WRAP_UP", tasks: [...WRAP_COMMON, ...(s.WRAP_UP ?? [])] },
      { name: "Handover & Closure", phase: "HANDOVER", tasks: [...HANDOVER_COMMON, ...(s.HANDOVER ?? [])] },
    ],
  };
}

const TEMPLATES: SOPDef[] = [
  sop("Standard Banquet Event", null, "Default operations checklist applied to any event without a more specific template.", {
    SETUP: [{ title: "Stage & backdrop setup", category: "DECOR", priority: "HIGH", proof: true, estimatedMinutes: 60 }],
  }, true),

  sop("Wedding", "Wedding", "Full wedding operations — mandap/stage, ceremonies and large-scale catering.", {
    PRE_EVENT: [
      { title: "Confirm muhurat / ceremony timings with family", category: "GENERAL", priority: "HIGH", mandatory: true },
      { title: "Coordinate pandit / officiant requirements", category: "GENERAL", priority: "MEDIUM" },
      { title: "Confirm baraat / entry plan & logistics", category: "LOGISTICS", priority: "HIGH" },
    ],
    SETUP: [
      { title: "Mandap / wedding stage & floral setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 120 },
      { title: "Bride & groom green rooms ready", category: "HOUSEKEEPING", priority: "HIGH", estimatedMinutes: 45 },
      { title: "Pheras / ceremony area arrangements", category: "DECOR", priority: "HIGH" },
    ],
    GUEST_ARRIVAL: [{ title: "Family & VIP seating coordination", category: "GUEST_SEATING", priority: "HIGH" }],
    LIVE_EVENT: [
      { title: "Cue ceremonies per muhurat timeline", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Coordinate rituals with pandit & family", category: "GENERAL", priority: "HIGH" },
      { title: "Grand feast service & live counters", category: "CATERING", priority: "HIGH" },
    ],
  }),

  sop("Reception", "Reception", "Post-wedding reception — grand entry, stage and dinner service.", {
    PRE_EVENT: [{ title: "Confirm grand-entry sequence & music", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true }],
    SETUP: [
      { title: "Reception stage & couch / sofa setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Photo wall / selfie point setup", category: "DECOR", priority: "MEDIUM" },
    ],
    GUEST_ARRIVAL: [{ title: "Receiving line & VIP coordination", category: "GUEST_SEATING", priority: "HIGH" }],
    LIVE_EVENT: [
      { title: "Couple grand entry cue", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Cake cutting & toast coordination", category: "ENTERTAINMENT", priority: "MEDIUM" },
    ],
  }),

  sop("Engagement", "Engagement", "Engagement / ring ceremony — stage, ring exchange and family seating.", {
    PRE_EVENT: [{ title: "Confirm ring-exchange timing & stage cue", category: "GENERAL", priority: "HIGH", mandatory: true }],
    SETUP: [
      { title: "Engagement stage & floral decor", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Couple seating & family rows", category: "GUEST_SEATING", priority: "HIGH" },
    ],
    LIVE_EVENT: [
      { title: "Ring ceremony cue & coordination", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Family & couple photo session", category: "GENERAL", priority: "MEDIUM" },
    ],
  }),

  sop("Sangeet", "Sangeet", "Sangeet night — performances, choreography and dance floor.", {
    PRE_EVENT: [
      { title: "Confirm performance running order & choreography", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Collect & sound-check performance tracks", category: "AV", priority: "HIGH", proof: true },
    ],
    SETUP: [
      { title: "Performance stage & dance floor setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Green room for performers", category: "HOUSEKEEPING", priority: "MEDIUM" },
    ],
    LIVE_EVENT: [
      { title: "Cue performances & manage music", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "MC / anchor coordination", category: "ENTERTAINMENT", priority: "MEDIUM" },
    ],
  }),

  sop("Mehandi", "Mehandi", "Mehandi function — artist stations, vibrant decor and music.", {
    PRE_EVENT: [{ title: "Confirm mehndi artist count & station needs", category: "LOGISTICS", priority: "HIGH", mandatory: true }],
    SETUP: [
      { title: "Mehndi artist stations & cushion seating", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Vibrant floral / umbrella decor", category: "DECOR", priority: "MEDIUM" },
    ],
    LIVE_EVENT: [
      { title: "Manage artist queue & guest flow", category: "GUEST_SEATING", priority: "HIGH" },
      { title: "Music / dhol coordination", category: "ENTERTAINMENT", priority: "MEDIUM" },
    ],
  }),

  sop("Haldi", "Haldi", "Haldi ceremony — low seating, turmeric ritual and stain-safe setup.", {
    PRE_EVENT: [
      { title: "Confirm haldi ritual items & dress code", category: "GENERAL", priority: "MEDIUM" },
      { title: "Plan stain-safe flooring / furniture covers", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
    ],
    SETUP: [
      { title: "Haldi stage, low seating & floral", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Protective covers on floor & seating", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
    ],
    LIVE_EVENT: [
      { title: "Ritual coordination with family", category: "GENERAL", priority: "HIGH" },
      { title: "Cleanup floaters on standby for turmeric", category: "HOUSEKEEPING", priority: "MEDIUM" },
    ],
  }),

  sop("Anniversary", "Anniversary", "Anniversary celebration — couple stage, cake and tribute.", {
    PRE_EVENT: [{ title: "Confirm anniversary theme, cake & milestone honours", category: "CATERING", priority: "HIGH", mandatory: true }],
    SETUP: [
      { title: "Couple stage & photo wall setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Slideshow / AV tribute ready", category: "AV", priority: "MEDIUM" },
    ],
    LIVE_EVENT: [
      { title: "Cake cutting & toast coordination", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Play tribute slideshow / speeches", category: "AV", priority: "MEDIUM" },
    ],
  }),

  sop("Birthday Party", "Birthday Party", "Birthday celebration — theme decor, cake and entertainment.", {
    PRE_EVENT: [
      { title: "Confirm cake design, flavour & delivery time", category: "CATERING", priority: "HIGH", mandatory: true },
      { title: "Confirm theme & entertainment (magician / games)", category: "ENTERTAINMENT", priority: "MEDIUM" },
    ],
    SETUP: [
      { title: "Theme decor & balloon setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Cake table & dessert counter setup", category: "CATERING", priority: "HIGH" },
    ],
    LIVE_EVENT: [
      { title: "Cake-cutting coordination", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Games / activities host", category: "ENTERTAINMENT", priority: "MEDIUM" },
    ],
  }),

  sop("Kids Party", "Kids Party", "Kids party — play zones, entertainer and child safety.", {
    PRE_EVENT: [
      { title: "Confirm theme, entertainer (clown/magician) & kid-safe menu", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Confirm child count & supervision needs", category: "SECURITY", priority: "HIGH" },
    ],
    SETUP: [
      { title: "Play area & soft / safe zones setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Cake & dessert counter at kid height", category: "CATERING", priority: "MEDIUM" },
    ],
    GUEST_ARRIVAL: [{ title: "Kid registration & parent wristbands", category: "SECURITY", priority: "HIGH" }],
    LIVE_EVENT: [
      { title: "Games / activities host", category: "ENTERTAINMENT", priority: "HIGH" },
      { title: "Continuous child safety supervision", category: "SECURITY", priority: "HIGH", mandatory: true },
    ],
  }),

  sop("Baby Shower", "Baby Shower", "Baby shower — rituals, special seating and themed decor.", {
    PRE_EVENT: [
      { title: "Confirm ritual requirements with family", category: "GENERAL", priority: "MEDIUM" },
      { title: "Confirm theme & special seating for mother-to-be", category: "DECOR", priority: "HIGH", mandatory: true },
    ],
    SETUP: [{ title: "Themed backdrop & special chair setup", category: "DECOR", priority: "HIGH", proof: true }],
    LIVE_EVENT: [
      { title: "Games & activities coordination", category: "ENTERTAINMENT", priority: "MEDIUM" },
      { title: "Gift table management", category: "GUEST_SEATING", priority: "LOW" },
    ],
  }),

  sop("Naming Ceremony", "Naming Ceremony", "Naming ceremony — ritual area, cradle and blessings.", {
    PRE_EVENT: [{ title: "Confirm ritual / pandit requirements & cradle decor", category: "GENERAL", priority: "HIGH", mandatory: true }],
    SETUP: [
      { title: "Cradle & ritual area setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Naming stage & family seating", category: "GUEST_SEATING", priority: "MEDIUM" },
    ],
    LIVE_EVENT: [
      { title: "Ritual coordination with pandit", category: "GENERAL", priority: "HIGH", mandatory: true },
      { title: "Blessings & family photo session", category: "GENERAL", priority: "MEDIUM" },
    ],
  }),

  sop("Cocktail Party", "Cocktail Party", "Cocktail party — bar service, canapés and lounge ambience.", {
    PRE_EVENT: [
      { title: "Confirm bar package & beverage count", category: "CATERING", priority: "HIGH", mandatory: true },
      { title: "Verify bar licence / permit", category: "SECURITY", priority: "HIGH", mandatory: true },
    ],
    SETUP: [
      { title: "Bar counters & beverage stock setup", category: "CATERING", priority: "HIGH", proof: true },
      { title: "High tables & lounge seating", category: "GUEST_SEATING", priority: "MEDIUM" },
    ],
    LIVE_EVENT: [
      { title: "Passed canapés & bar service", category: "CATERING", priority: "HIGH" },
      { title: "Responsible-alcohol monitoring", category: "SECURITY", priority: "HIGH", mandatory: true },
    ],
  }),

  sop("Bachelor Party", "Bachelor Party", "Bachelor party — entertainment, bar and crowd safety.", {
    PRE_EVENT: [
      { title: "Confirm entertainment / DJ / acts", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Confirm bar package & age verification plan", category: "SECURITY", priority: "HIGH", mandatory: true },
    ],
    SETUP: [
      { title: "Stage / DJ & dance floor setup", category: "AV", priority: "HIGH", proof: true },
      { title: "Bar & lounge setup", category: "CATERING", priority: "HIGH" },
    ],
    LIVE_EVENT: [
      { title: "Bar service & responsible-alcohol monitoring", category: "SECURITY", priority: "HIGH", mandatory: true },
      { title: "Entertainment & DJ cue management", category: "ENTERTAINMENT", priority: "MEDIUM" },
    ],
  }),

  sop("Fresher Party", "Fresher Party", "Fresher / farewell party — performances, games and titles.", {
    PRE_EVENT: [{ title: "Confirm performances, anchor & games / titles", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true }],
    SETUP: [
      { title: "Stage, DJ & dance floor setup", category: "AV", priority: "HIGH", proof: true },
      { title: "Photo booth / selfie point", category: "DECOR", priority: "LOW" },
    ],
    LIVE_EVENT: [
      { title: "Cue performances & anchor segments", category: "ENTERTAINMENT", priority: "HIGH" },
      { title: "Games & titles / awards segment", category: "ENTERTAINMENT", priority: "MEDIUM" },
    ],
  }),

  sop("New Year Party", "New Year Party", "New Year party — countdown, midnight toast and crowd safety.", {
    PRE_EVENT: [
      { title: "Confirm countdown plan & midnight toast", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Confirm entertainment / DJ & bar package", category: "ENTERTAINMENT", priority: "HIGH" },
    ],
    SETUP: [
      { title: "Stage, DJ & countdown screen setup", category: "AV", priority: "HIGH", proof: true },
      { title: "Bar & beverage counters setup", category: "CATERING", priority: "HIGH" },
    ],
    LIVE_EVENT: [
      { title: "Countdown & midnight toast cue", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Bar service & crowd-safety monitoring", category: "SECURITY", priority: "HIGH", mandatory: true },
    ],
  }),

  sop("Get-together", "Get-together", "Casual get-together — relaxed seating, buffet and music.", {
    SETUP: [{ title: "Casual lounge / cluster seating setup", category: "GUEST_SEATING", priority: "MEDIUM" }],
    LIVE_EVENT: [{ title: "Buffet flow & background music", category: "CATERING", priority: "MEDIUM" }],
  }),

  sop("Team Outing", "Team Outing", "Corporate team outing — activities, transport and meals.", {
    PRE_EVENT: [
      { title: "Confirm activities, agenda & headcount", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Confirm transport / logistics for the group", category: "LOGISTICS", priority: "HIGH" },
    ],
    SETUP: [{ title: "Activity stations & seating setup", category: "LOGISTICS", priority: "MEDIUM" }],
    LIVE_EVENT: [
      { title: "Activity coordination & participant safety", category: "SECURITY", priority: "HIGH", mandatory: true },
      { title: "Meals & refreshments service", category: "CATERING", priority: "MEDIUM" },
    ],
  }),

  sop("Conference", "Conference", "Conference — AV, registration, multi-session agenda.", {
    PRE_EVENT: [
      { title: "Confirm AV / presentation & internet requirements", category: "AV", priority: "HIGH", mandatory: true },
      { title: "Confirm registration / badge & agenda needs", category: "LOGISTICS", priority: "HIGH" },
    ],
    SETUP: [
      { title: "Theatre / classroom seating setup", category: "GUEST_SEATING", priority: "HIGH" },
      { title: "Stage, podium & branding setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Test presentation, clicker & internet", category: "AV", priority: "HIGH", mandatory: true, proof: true },
    ],
    GUEST_ARRIVAL: [{ title: "Registration desk & badges ready", category: "LOGISTICS", priority: "HIGH" }],
    LIVE_EVENT: [
      { title: "Session timekeeping & speaker support", category: "AV", priority: "HIGH", mandatory: true },
      { title: "Tea / coffee & networking breaks", category: "CATERING", priority: "MEDIUM" },
    ],
  }),

  sop("Seminar", "Seminar", "Seminar — presentation setup, registration and Q&A.", {
    PRE_EVENT: [
      { title: "Confirm AV / presentation & handouts", category: "AV", priority: "HIGH", mandatory: true },
      { title: "Confirm registration & materials", category: "LOGISTICS", priority: "MEDIUM" },
    ],
    SETUP: [
      { title: "Classroom / theatre seating setup", category: "GUEST_SEATING", priority: "HIGH" },
      { title: "Projector & mic test", category: "AV", priority: "HIGH", mandatory: true, proof: true },
    ],
    GUEST_ARRIVAL: [{ title: "Registration & material handout", category: "LOGISTICS", priority: "HIGH" }],
    LIVE_EVENT: [
      { title: "Session timekeeping", category: "GENERAL", priority: "HIGH" },
      { title: "Q&A mic runners & refreshment breaks", category: "AV", priority: "MEDIUM" },
    ],
  }),

  sop("Corporate Event", "Corporate Event", "Corporate event — AV, branding, registration and networking.", {
    PRE_EVENT: [
      { title: "Confirm AV / presentation & internet requirements", category: "AV", priority: "HIGH", mandatory: true },
      { title: "Confirm registration / badge needs", category: "LOGISTICS", priority: "MEDIUM" },
    ],
    SETUP: [
      { title: "Stage, podium & branding setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Test presentation, clicker & internet", category: "AV", priority: "HIGH", mandatory: true, proof: true },
    ],
    GUEST_ARRIVAL: [{ title: "Registration desk & badges ready", category: "LOGISTICS", priority: "HIGH" }],
    LIVE_EVENT: [
      { title: "Agenda timekeeping & speaker support", category: "AV", priority: "HIGH", mandatory: true },
      { title: "Networking & refreshments coordination", category: "CATERING", priority: "MEDIUM" },
    ],
  }),

  sop("Corporate Party", "Corporate Party", "Corporate party — stage, bar, entertainment and awards.", {
    PRE_EVENT: [
      { title: "Confirm theme, entertainment & awards segment", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
      { title: "Confirm bar package & beverage count", category: "CATERING", priority: "HIGH" },
    ],
    SETUP: [
      { title: "Stage, DJ & branding setup", category: "AV", priority: "HIGH", proof: true },
      { title: "Bar & lounge setup", category: "CATERING", priority: "HIGH" },
    ],
    LIVE_EVENT: [
      { title: "Entertainment & awards segment cue", category: "ENTERTAINMENT", priority: "HIGH" },
      { title: "Bar service & responsible-alcohol monitoring", category: "SECURITY", priority: "HIGH", mandatory: true },
    ],
  }),

  sop("Pre-Wedding Shoot", "Pre-Wedding Shoot", "Pre-wedding shoot — sets, props, lighting and locations.", {
    PRE_EVENT: [
      { title: "Confirm shoot locations / sets & time slots", category: "LOGISTICS", priority: "HIGH", mandatory: true },
      { title: "Confirm props list & wardrobe changes", category: "DECOR", priority: "MEDIUM" },
    ],
    SETUP: [
      { title: "Sets, props & lighting setup", category: "DECOR", priority: "HIGH", proof: true },
      { title: "Changing / makeup room ready", category: "HOUSEKEEPING", priority: "MEDIUM" },
    ],
    LIVE_EVENT: [
      { title: "Location / scene coordination with photographer", category: "GENERAL", priority: "HIGH", mandatory: true },
      { title: "Props & continuity management", category: "DECOR", priority: "MEDIUM" },
    ],
  }),
];

// ---- Email templates (simple, brand-styled) ----
const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const emailShell = (body: string) =>
  `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${PLUM};max-width:600px;margin:0 auto">
    <div style="border-bottom:3px solid ${GOLD};padding:12px 0;font-size:20px;font-weight:800">Veloria Grand<span style="display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD}">Premium Event Venues</span></div>
    <div style="padding:18px 0;font-size:14px;line-height:1.7">${body}</div>
    <div style="border-top:1px solid #e6dccb;padding-top:10px;font-size:11px;color:#6b5b73">Veloria Grand · Bengaluru · support@theveloriagrand.com</div>
  </div>`;

const EMAIL_TEMPLATES = [
  {
    name: "Quotation Sent",
    category: "QUOTATION",
    subject: "Your Veloria Grand Quotation — {{quoteNumber}}",
    htmlContent: emailShell(
      `<p>Dear {{clientName}},</p><p>Thank you for considering Veloria Grand for your {{occasion}}. Please find your event quotation attached.</p><p><strong>Grand total:</strong> {{grandTotal}}</p><p>This quote is valid for 15 days. To reserve your date, a 10% booking advance blocks the slot in your name.</p><p>Warm regards,<br/>Team Veloria Grand</p>`
    ),
  },
  {
    name: "Booking Confirmed",
    category: "BOOKING",
    subject: "Booking Confirmed — {{bookingNumber}}",
    htmlContent: emailShell(
      `<p>Dear {{clientName}},</p><p>We're delighted to confirm your booking <strong>{{bookingNumber}}</strong> at <strong>{{venueName}}</strong> for <strong>{{eventDate}}</strong> ({{timeSlot}}).</p><p>Your slot is now locked in your name. Your point of contact is <strong>{{pocName}}</strong> ({{pocPhone}}).</p><p>We look forward to hosting you.</p><p>Warm regards,<br/>Team Veloria Grand</p>`
    ),
  },
  {
    name: "Payment Reminder",
    category: "PAYMENT",
    subject: "Friendly reminder — payment due for {{bookingNumber}}",
    htmlContent: emailShell(
      `<p>Dear {{clientName}},</p><p>This is a gentle reminder that an installment of <strong>{{amountDue}}</strong> for booking <strong>{{bookingNumber}}</strong> is due on <strong>{{dueDate}}</strong>.</p><p>You can pay securely via the link we shared, or reach your coordinator for assistance.</p><p>Thank you,<br/>Team Veloria Grand</p>`
    ),
  },
  {
    name: "Thank You & Feedback",
    category: "POST_EVENT",
    subject: "Thank you for celebrating with Veloria Grand",
    htmlContent: emailShell(
      `<p>Dear {{clientName}},</p><p>Thank you for letting Veloria Grand be part of your special day. We hope it was everything you imagined.</p><p>We'd love your feedback — it helps us serve you better next time. A referral from you means the world to us too.</p><p>With gratitude,<br/>Team Veloria Grand</p>`
    ),
  },
];

// ---- WhatsApp message templates (plain text, stored under category WHATSAPP) ----
const WHATSAPP_TEMPLATES = [
  {
    name: "WhatsApp — Quotation Sent",
    category: "WHATSAPP",
    subject: "Quotation",
    body: "Hi {{clientName}}, thank you for considering Veloria Grand for your {{occasion}}! 🎉 Your quotation total is {{grandTotal}}. To reserve your date, a 10% advance blocks the slot in your name. Reply here with any questions. — Team Veloria Grand",
  },
  {
    name: "WhatsApp — Booking Confirmed",
    category: "WHATSAPP",
    subject: "Booking Confirmed",
    body: "Hi {{clientName}}, your booking {{bookingNumber}} at {{venueName}} on {{eventDate}} ({{timeSlot}}) is CONFIRMED ✅. Your point of contact is {{pocName}} ({{pocPhone}}). We can't wait to host you! — Team Veloria Grand",
  },
  {
    name: "WhatsApp — Payment Reminder",
    category: "WHATSAPP",
    subject: "Payment Reminder",
    body: "Hi {{clientName}}, a gentle reminder: an installment of {{amountDue}} for booking {{bookingNumber}} is due on {{dueDate}}. You can pay via the link we shared or reply here for help. — Team Veloria Grand",
  },
  {
    name: "WhatsApp — Thank You",
    category: "WHATSAPP",
    subject: "Thank You",
    body: "Hi {{clientName}}, thank you for celebrating with Veloria Grand! 🙏 We'd love your feedback, and a referral means the world to us. — Team Veloria Grand",
  },
];

// ---- Standard event packages (sales catalog) ----
interface PackageItem {
  name: string;
  category?: string;
  quantity?: number;
  unitPrice: number;
}
interface PackageDef {
  name: string;
  eventType: string;
  tier: "BASIC" | "STANDARD" | "PREMIUM" | "CUSTOM";
  basePrice: number; // per-plate for food tiers; bundled price for event packages
  description: string;
  items: PackageItem[];
}
const PACKAGES: PackageDef[] = [
  // Per-plate food tiers (match the quotation planner).
  { name: "Veg Silver — Per Plate", eventType: "Catering", tier: "BASIC", basePrice: 599, description: "Pure-veg silver menu, ₹599 per plate.", items: [{ name: "Veg Silver menu", category: "Catering", unitPrice: 599 }] },
  { name: "Veg Gold — Per Plate", eventType: "Catering", tier: "STANDARD", basePrice: 699, description: "Pure-veg gold menu, ₹699 per plate.", items: [{ name: "Veg Gold menu", category: "Catering", unitPrice: 699 }] },
  { name: "Veg Platinum — Per Plate", eventType: "Catering", tier: "PREMIUM", basePrice: 899, description: "Pure-veg platinum menu, ₹899 per plate.", items: [{ name: "Veg Platinum menu", category: "Catering", unitPrice: 899 }] },
  { name: "Non-Veg Premium — Per Plate", eventType: "Catering", tier: "PREMIUM", basePrice: 1099, description: "Premium non-veg menu, ₹1099 per plate.", items: [{ name: "Premium Non-veg menu", category: "Catering", unitPrice: 1099 }] },
  // Bundled event packages.
  {
    name: "Birthday Bliss", eventType: "Birthday", tier: "STANDARD", basePrice: 35000,
    description: "Turnkey birthday package — themed decor, cake, and photography.",
    items: [
      { name: "Themed balloon decor", category: "Decor", unitPrice: 16000 },
      { name: "2 kg premium cake", category: "Cake", unitPrice: 4000 },
      { name: "Photography (3 hrs)", category: "Photography", unitPrice: 15000 },
    ],
  },
  {
    name: "Engagement Elegance", eventType: "Engagement", tier: "PREMIUM", basePrice: 55000,
    description: "Engagement package — stage decor, photography & videography.",
    items: [
      { name: "Engagement stage & floral decor", category: "Decor", unitPrice: 25000 },
      { name: "Photography + videography", category: "Photography", unitPrice: 30000 },
    ],
  },
  {
    name: "Wedding Grandeur", eventType: "Wedding", tier: "PREMIUM", basePrice: 150000,
    description: "Premium wedding package — mandap, lighting, photography & videography.",
    items: [
      { name: "Mandap & floral decor", category: "Decor", unitPrice: 90000 },
      { name: "Ambient lighting", category: "Decor", unitPrice: 25000 },
      { name: "Cinematic photography + videography", category: "Photography", unitPrice: 35000 },
    ],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedTemplates(prisma: PrismaClient | any): Promise<void> {
  // ---- SOP templates ----
  // Only claim "default" if the org doesn't already have one (prod may have
  // been seeded with a default earlier — don't create dueling defaults).
  const hasDefault = !!(await prisma.sOPTemplate.findFirst({ where: { isDefault: true }, select: { id: true } }));
  let sopCreated = 0;
  let sopRefreshed = 0;
  // The phase/task tree is identical whether we create or refresh.
  const buildPhases = (t: SOPDef) => ({
    create: t.phases.map((p, pi) => ({
      name: p.name,
      phase: p.phase,
      order: pi,
      taskDefinitions: {
        create: p.tasks.map((task, ti) => ({
          title: task.title,
          description: task.description ?? null,
          category: task.category,
          priority: task.priority ?? "MEDIUM",
          estimatedMinutes: task.estimatedMinutes ?? null,
          isMandatory: !!task.mandatory,
          requiresApproval: !!task.approval,
          requiresProof: !!task.proof,
          order: ti,
        })),
      },
    })),
  });

  for (const t of TEMPLATES) {
    const existing = await prisma.sOPTemplate.findFirst({ where: { name: t.name }, select: { id: true } });
    if (existing) {
      // Refresh (sync) the canonical, system-managed templates so reworked /
      // expanded task lists actually reach an already-seeded database. The
      // template id is kept stable — live ExecutionPlans copied their phases at
      // confirm time, so refreshing the template never disturbs an in-flight
      // event. We replace the phase tree wholesale and update eventType, but
      // leave isDefault alone (so we never create dueling defaults).
      await prisma.sOPPhase.deleteMany({ where: { templateId: existing.id } });
      await prisma.sOPTemplate.update({
        where: { id: existing.id },
        data: { eventType: t.eventType, isActive: true, phases: buildPhases(t) },
      });
      sopRefreshed++;
    } else {
      await prisma.sOPTemplate.create({
        data: {
          name: t.name,
          eventType: t.eventType,
          isActive: true,
          isDefault: !!t.isDefault && !hasDefault,
          phases: buildPhases(t),
        },
      });
      sopCreated++;
    }
  }
  console.log(`[bootstrap] SOP templates: created ${sopCreated}, refreshed ${sopRefreshed}`);

  // ---- Email templates ----
  let emailCreated = 0;
  for (const e of EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: e.name }, select: { id: true } });
    if (existing) continue;
    await prisma.emailTemplate.create({
      data: { name: e.name, subject: e.subject, htmlContent: e.htmlContent, category: e.category, isActive: true },
    });
    emailCreated++;
  }
  console.log(`[bootstrap] Email templates: created ${emailCreated}, ${EMAIL_TEMPLATES.length - emailCreated} already present`);

  // ---- WhatsApp message templates (reuse EmailTemplate with category WHATSAPP) ----
  let waCreated = 0;
  for (const w of WHATSAPP_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: w.name }, select: { id: true } });
    if (existing) continue;
    await prisma.emailTemplate.create({
      data: { name: w.name, subject: w.subject, htmlContent: w.body, category: w.category, isActive: true },
    });
    waCreated++;
  }
  console.log(`[bootstrap] WhatsApp templates: created ${waCreated}, ${WHATSAPP_TEMPLATES.length - waCreated} already present`);

  // ---- Event packages ----
  let pkgCreated = 0;
  for (const p of PACKAGES) {
    const existing = await prisma.eventPackage.findFirst({ where: { name: p.name }, select: { id: true } });
    if (existing) continue;
    await prisma.eventPackage.create({
      data: {
        name: p.name,
        description: p.description,
        eventType: p.eventType,
        basePrice: p.basePrice,
        tier: p.tier,
        isActive: true,
        items: {
          create: p.items.map((it, i) => ({
            name: it.name,
            category: it.category ?? null,
            quantity: it.quantity ?? 1,
            unitPrice: it.unitPrice,
            isIncluded: true,
            order: i,
          })),
        },
      },
    });
    pkgCreated++;
  }
  console.log(`[bootstrap] Event packages: created ${pkgCreated}, ${PACKAGES.length - pkgCreated} already present`);

  // ---- Vendor Module: one sample multi-category vendor + the canonical
  // "Veg Silver Package" (the spec's Phase-3 acceptance fixture). Idempotent:
  // only created if the vendor doesn't already exist.
  const SAMPLE_VENDOR = "Spice Route Caterers";
  const existingVendor = await prisma.vendor.findFirst({
    where: { name: { equals: SAMPLE_VENDOR, mode: "insensitive" } },
    select: { id: true },
  });
  if (!existingVendor) {
    const v = await prisma.vendor.create({
      data: {
        name: SAMPLE_VENDOR,
        category: "CATERING",
        categories: ["catering", "decor"],
        empanelmentStatus: "empanelled",
        city: "Bengaluru",
        company: "Mr. Imran (Head Chef)",
        phone: "+91 98800 12345",
        email: "hello@spiceroute.example",
        keyPersonnel: [
          { name: "Imran Q.", role: "Head Chef" },
          { name: "Lakshmi R.", role: "Service Captain" },
        ],
        licences: [{ type: "FSSAI", number: "12345678901234", expiry: "2027-03-31" }],
        notes: "Sample vendor seeded for the Vendor Module catalogue.",
      },
      select: { id: true },
    });
    await prisma.vendorPackage.create({
      data: {
        vendorId: v.id,
        name: "Veg Silver Package",
        category: "catering",
        status: "ACTIVE",
        price: 950,
        priceUnit: "PER_PLATE",
        currency: "INR",
        description: "Pure-veg buffet · min 100 pax · 90-minute service window. Live counters extra.",
        sections: {
          create: [
            {
              title: "Welcome", sortOrder: 0,
              items: {
                create: [
                  { name: "Welcome Juice", type: "SINGLE_CHOICE", options: ["Watermelon", "Grape", "Pineapple"], sortOrder: 0, notes: "Served chilled" },
                ],
              },
            },
            {
              title: "Starters", sortOrder: 1,
              items: {
                create: [
                  { name: "Choose any 3 starters", type: "MULTI_CHOICE", chooseCount: 3, sortOrder: 0,
                    options: ["Paneer Tikka", "Veg Spring Roll", "Hara Bhara Kebab", "Corn Cheese Balls", "Gobi Manchurian"] },
                ],
              },
            },
            {
              title: "Main Course", sortOrder: 2,
              items: {
                create: [
                  { name: "Dal Tadka", type: "FIXED", options: [], sortOrder: 0 },
                  { name: "Jeera Rice", type: "FIXED", options: [], sortOrder: 1 },
                  { name: "Choose a bread", type: "SINGLE_CHOICE", options: ["Butter Naan", "Tandoori Roti", "Lachha Paratha"], sortOrder: 2 },
                  { name: "Mixed Vegetable Curry", type: "FIXED", options: [], sortOrder: 3 },
                ],
              },
            },
            {
              title: "Dessert", sortOrder: 3,
              items: {
                create: [
                  { name: "Choose any 2 desserts", type: "MULTI_CHOICE", chooseCount: 2, sortOrder: 0,
                    options: ["Gulab Jamun", "Vanilla Ice Cream", "Rasmalai", "Gajar Halwa"] },
                ],
              },
            },
          ],
        },
      },
    });
    console.log("[bootstrap] Vendor catalogue: seeded sample vendor + Veg Silver Package");
  } else {
    console.log("[bootstrap] Vendor catalogue: sample vendor already present");
  }
}
