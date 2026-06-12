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
  { title: "Confirm all vendors (caterer, decor, photographer, DJ)", category: "LOGISTICS", priority: "HIGH", mandatory: true, estimatedMinutes: 60 },
  { title: "Verify balance payment status before event day", category: "GENERAL", priority: "HIGH", mandatory: true, estimatedMinutes: 15 },
  { title: "Circulate final run-sheet (BEO) to ops team", category: "GENERAL", priority: "HIGH", estimatedMinutes: 30 },
];
const SETUP_COMMON: TaskDef[] = [
  { title: "Deep-clean & sanitize the hall", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, estimatedMinutes: 90 },
  { title: "Lay tables & chairs per floor plan", category: "GUEST_SEATING", priority: "HIGH", estimatedMinutes: 60 },
  { title: "AV check — mics, speakers, projector", category: "AV", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 45 },
  { title: "Lighting setup & test", category: "AV", priority: "MEDIUM", estimatedMinutes: 30 },
  { title: "Buffet / live counters setup", category: "CATERING", priority: "HIGH", estimatedMinutes: 60 },
  { title: "Welcome signage & directions placed", category: "LOGISTICS", priority: "LOW", estimatedMinutes: 20 },
];
const ARRIVAL_COMMON: TaskDef[] = [
  { title: "Reception desk & guest list ready", category: "GUEST_SEATING", priority: "HIGH", estimatedMinutes: 20 },
  { title: "Welcome drinks ready at entrance", category: "CATERING", priority: "MEDIUM", estimatedMinutes: 20 },
  { title: "Valet & parking coordination", category: "LOGISTICS", priority: "MEDIUM", estimatedMinutes: 15 },
  { title: "Brief ushers & security on guest flow", category: "SECURITY", priority: "MEDIUM", estimatedMinutes: 15 },
];
const WRAP_COMMON: TaskDef[] = [
  { title: "Collect host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true, estimatedMinutes: 15 },
  { title: "Vendor settlement & sign-off checklist", category: "LOGISTICS", priority: "HIGH", estimatedMinutes: 30 },
  { title: "Return rented equipment & reconcile inventory", category: "LOGISTICS", priority: "MEDIUM", estimatedMinutes: 30 },
  { title: "Lost & found collection", category: "GENERAL", priority: "LOW", estimatedMinutes: 10 },
];
const HANDOVER_COMMON: TaskDef[] = [
  { title: "Hall handover & damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 30 },
  { title: "Final settlement & invoice closure", category: "GENERAL", priority: "HIGH", approval: true, estimatedMinutes: 20 },
  { title: "Post-event report & photos archived", category: "GENERAL", priority: "LOW", estimatedMinutes: 20 },
];

const TEMPLATES: SOPDef[] = [
  {
    name: "Standard Banquet Event",
    eventType: null,
    isDefault: true,
    description: "Default operations checklist applied to any event without a more specific template.",
    phases: [
      { name: "Pre-Event Preparation", phase: "PRE_EVENT", tasks: PRE_EVENT_COMMON },
      { name: "Venue Setup", phase: "SETUP", tasks: [...SETUP_COMMON, { title: "Stage & backdrop setup", category: "DECOR", priority: "HIGH", proof: true, estimatedMinutes: 60 }] },
      { name: "Guest Arrival", phase: "GUEST_ARRIVAL", tasks: ARRIVAL_COMMON },
      {
        name: "During the Event", phase: "LIVE_EVENT", tasks: [
          { title: "Food service as per timeline", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Monitor AC, cleanliness & restrooms", category: "HOUSEKEEPING", priority: "MEDIUM" },
          { title: "Coordinate program / MC cues", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Photography / videography coverage", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      { name: "Wind-Down", phase: "WRAP_UP", tasks: WRAP_COMMON },
      { name: "Handover & Closure", phase: "HANDOVER", tasks: HANDOVER_COMMON },
    ],
  },
  {
    name: "Wedding Reception",
    eventType: "Wedding",
    description: "End-to-end checklist for a wedding reception including mandap/stage, ceremonies and large-scale catering.",
    phases: [
      {
        name: "Pre-Event Preparation", phase: "PRE_EVENT", tasks: [
          ...PRE_EVENT_COMMON,
          { title: "Confirm muhurat / ceremony timings with family", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Coordinate pandit / officiant requirements", category: "GENERAL", priority: "MEDIUM" },
          { title: "Confirm baraat / entry plan & logistics", category: "LOGISTICS", priority: "HIGH" },
        ],
      },
      {
        name: "Venue Setup", phase: "SETUP", tasks: [
          ...SETUP_COMMON,
          { title: "Mandap / wedding stage & floral setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true, estimatedMinutes: 120 },
          { title: "Bride & groom green rooms ready", category: "HOUSEKEEPING", priority: "HIGH", estimatedMinutes: 45 },
          { title: "Pheras / ceremony area arrangements", category: "DECOR", priority: "HIGH" },
        ],
      },
      { name: "Guest Arrival", phase: "GUEST_ARRIVAL", tasks: [...ARRIVAL_COMMON, { title: "Family & VIP seating coordination", category: "GUEST_SEATING", priority: "HIGH" }] },
      {
        name: "During the Event", phase: "LIVE_EVENT", tasks: [
          { title: "Baraat welcome & entry coordination", category: "ENTERTAINMENT", priority: "HIGH" },
          { title: "Stage & ceremony timeline management", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Multi-cuisine food service & live counters", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Photography / videography — key moments", category: "GENERAL", priority: "HIGH" },
          { title: "Monitor guest comfort & crowd flow", category: "SECURITY", priority: "MEDIUM" },
        ],
      },
      { name: "Wind-Down", phase: "WRAP_UP", tasks: WRAP_COMMON },
      { name: "Handover & Closure", phase: "HANDOVER", tasks: HANDOVER_COMMON },
    ],
  },
  {
    name: "Birthday Party",
    eventType: "Birthday",
    description: "Checklist for birthday celebrations — cake, themed decor and entertainment.",
    phases: [
      { name: "Pre-Event Preparation", phase: "PRE_EVENT", tasks: [...PRE_EVENT_COMMON, { title: "Confirm cake design, flavour & delivery time", category: "CATERING", priority: "HIGH", mandatory: true }, { title: "Confirm theme & entertainment (magician/games)", category: "ENTERTAINMENT", priority: "MEDIUM" }] },
      { name: "Venue Setup", phase: "SETUP", tasks: [...SETUP_COMMON, { title: "Theme decor & balloon setup", category: "DECOR", priority: "HIGH", proof: true }, { title: "Cake table & dessert counter setup", category: "CATERING", priority: "HIGH" }] },
      { name: "Guest Arrival", phase: "GUEST_ARRIVAL", tasks: ARRIVAL_COMMON },
      {
        name: "During the Event", phase: "LIVE_EVENT", tasks: [
          { title: "Cake-cutting coordination & music cue", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Games / entertainment management", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Food & dessert service", category: "CATERING", priority: "HIGH" },
          { title: "Return gifts / favours distribution", category: "GENERAL", priority: "LOW" },
        ],
      },
      { name: "Wind-Down", phase: "WRAP_UP", tasks: WRAP_COMMON },
      { name: "Handover & Closure", phase: "HANDOVER", tasks: HANDOVER_COMMON },
    ],
  },
  {
    name: "Baby Shower",
    eventType: "Baby shower",
    description: "Checklist for baby shower / godh bharai functions — intimate decor and rituals.",
    phases: [
      { name: "Pre-Event Preparation", phase: "PRE_EVENT", tasks: [...PRE_EVENT_COMMON, { title: "Confirm ritual requirements with family", category: "GENERAL", priority: "MEDIUM" }, { title: "Confirm theme decor & special seating for mother-to-be", category: "DECOR", priority: "HIGH" }] },
      { name: "Venue Setup", phase: "SETUP", tasks: [...SETUP_COMMON, { title: "Themed backdrop & special chair setup", category: "DECOR", priority: "HIGH", proof: true }] },
      { name: "Guest Arrival", phase: "GUEST_ARRIVAL", tasks: ARRIVAL_COMMON },
      {
        name: "During the Event", phase: "LIVE_EVENT", tasks: [
          { title: "Ritual / ceremony coordination", category: "GENERAL", priority: "HIGH" },
          { title: "Games & activities management", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Food & dessert service", category: "CATERING", priority: "HIGH", mandatory: true },
        ],
      },
      { name: "Wind-Down", phase: "WRAP_UP", tasks: WRAP_COMMON },
      { name: "Handover & Closure", phase: "HANDOVER", tasks: HANDOVER_COMMON },
    ],
  },
  {
    name: "Engagement / Ring Ceremony",
    eventType: "Engagement",
    description: "Checklist for engagement / ring ceremony functions.",
    phases: [
      { name: "Pre-Event Preparation", phase: "PRE_EVENT", tasks: [...PRE_EVENT_COMMON, { title: "Confirm ring-exchange timing & stage cue", category: "GENERAL", priority: "HIGH", mandatory: true }] },
      { name: "Venue Setup", phase: "SETUP", tasks: [...SETUP_COMMON, { title: "Engagement stage & floral decor", category: "DECOR", priority: "HIGH", proof: true }, { title: "Couple seating & family rows", category: "GUEST_SEATING", priority: "HIGH" }] },
      { name: "Guest Arrival", phase: "GUEST_ARRIVAL", tasks: ARRIVAL_COMMON },
      {
        name: "During the Event", phase: "LIVE_EVENT", tasks: [
          { title: "Ring-exchange ceremony coordination", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Photography — key moments", category: "GENERAL", priority: "HIGH" },
          { title: "Food & beverage service", category: "CATERING", priority: "HIGH" },
        ],
      },
      { name: "Wind-Down", phase: "WRAP_UP", tasks: WRAP_COMMON },
      { name: "Handover & Closure", phase: "HANDOVER", tasks: HANDOVER_COMMON },
    ],
  },
  {
    name: "Corporate Event",
    eventType: "Corporate",
    description: "Checklist for corporate functions — conferences, town-halls, product launches, parties.",
    phases: [
      { name: "Pre-Event Preparation", phase: "PRE_EVENT", tasks: [...PRE_EVENT_COMMON, { title: "Confirm AV/presentation & internet requirements", category: "AV", priority: "HIGH", mandatory: true }, { title: "Confirm registration / badge needs", category: "LOGISTICS", priority: "MEDIUM" }] },
      { name: "Venue Setup", phase: "SETUP", tasks: [...SETUP_COMMON, { title: "Conference / theatre seating setup", category: "GUEST_SEATING", priority: "HIGH" }, { title: "Stage, podium & branding setup", category: "DECOR", priority: "HIGH", proof: true }, { title: "Test presentation, clicker & internet", category: "AV", priority: "HIGH", mandatory: true, proof: true }] },
      { name: "Guest Arrival", phase: "GUEST_ARRIVAL", tasks: [...ARRIVAL_COMMON, { title: "Registration desk & badges ready", category: "LOGISTICS", priority: "HIGH" }] },
      {
        name: "During the Event", phase: "LIVE_EVENT", tasks: [
          { title: "AV / presentation support on standby", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Agenda / session timeline management", category: "GENERAL", priority: "HIGH" },
          { title: "Tea / coffee breaks & lunch service", category: "CATERING", priority: "HIGH" },
        ],
      },
      { name: "Wind-Down", phase: "WRAP_UP", tasks: WRAP_COMMON },
      { name: "Handover & Closure", phase: "HANDOVER", tasks: HANDOVER_COMMON },
    ],
  },
  // ---- 7 additional event types (generated) ----
  {
    name: "Reception",
    eventType: "Reception",
    description: "Operations checklist for Reception events.",
    phases: [
      {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        tasks: [
          { title: "Confirm final guest count (pax) and per-plate count with host", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Lock multi-cuisine menu and live counters with kitchen", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Confirm couple stage entry time, music cue and spotlight sequence", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Confirm all vendors — caterer, decor, photographer, DJ, lighting", category: "LOGISTICS", priority: "HIGH", mandatory: true },
          { title: "Verify balance payment cleared before event day", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Circulate final run-sheet (BEO) and stage timeline to ops team", category: "GENERAL", priority: "HIGH" },
          { title: "Confirm valet capacity and traffic-marshal plan for peak arrival", category: "LOGISTICS", priority: "MEDIUM" },
        ],
      },
      {
        name: "Venue Setup",
        phase: "SETUP",
        tasks: [
          { title: "Deep-clean and sanitize hall, restrooms and green rooms", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Reception stage, backdrop and floral decor setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Couple sofa/throne, pheras backdrop and family rows arranged", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "Lay round tables, chairs and VIP enclosure per floor plan", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "AV check — wireless mics, line array speakers, mixer", category: "AV", priority: "HIGH", mandatory: true, proof: true },
          { title: "Stage uplighting, follow-spot and ambient lighting test", category: "AV", priority: "MEDIUM" },
          { title: "Buffet and live counters setup with sneeze guards", category: "CATERING", priority: "HIGH" },
          { title: "Fire exits unobstructed, extinguishers and DG backup checked", category: "SECURITY", priority: "URGENT", mandatory: true, proof: true },
          { title: "Welcome signage, gift/shagun table and directions placed", category: "LOGISTICS", priority: "LOW" },
        ],
      },
      {
        name: "Guest Arrival",
        phase: "GUEST_ARRIVAL",
        tasks: [
          { title: "Reception desk, guest list and shagun box ready", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "Welcome drinks and aarti/tilak thali ready at entrance", category: "CATERING", priority: "MEDIUM" },
          { title: "Valet and parking coordination at peak inflow", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Brief ushers and security on VIP and guest flow", category: "SECURITY", priority: "MEDIUM" },
          { title: "Family and elderly/VIP seating coordination", category: "GUEST_SEATING", priority: "HIGH" },
        ],
      },
      {
        name: "During the Event",
        phase: "LIVE_EVENT",
        tasks: [
          { title: "Couple grand entry — music, spotlight and cold-pyro cue", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Stage felicitation and gift-exchange queue management", category: "ENTERTAINMENT", priority: "HIGH" },
          { title: "Multi-cuisine food service and live counters as per timeline", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Photography/videography — key moments and family portraits", category: "GENERAL", priority: "HIGH" },
          { title: "Monitor AC, cleanliness, restrooms and crowd flow", category: "HOUSEKEEPING", priority: "MEDIUM" },
          { title: "Cake-cutting / toast coordination with DJ and MC", category: "ENTERTAINMENT", priority: "MEDIUM" },
        ],
      },
      {
        name: "Wind-Down",
        phase: "WRAP_UP",
        tasks: [
          { title: "Collect host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true },
          { title: "Hand over gifts, shagun box and host belongings safely", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Vendor settlement and sign-off checklist", category: "LOGISTICS", priority: "HIGH" },
          { title: "Return rented equipment and reconcile inventory", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Lost and found collection", category: "GENERAL", priority: "LOW" },
        ],
      },
      {
        name: "Handover & Closure",
        phase: "HANDOVER",
        tasks: [
          { title: "Hall handover and damage inspection with host", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Final settlement and invoice closure", category: "GENERAL", priority: "HIGH" },
          { title: "Post-event report and photos archived", category: "GENERAL", priority: "LOW" },
        ],
      },
    ],
  },
  {
    name: "Sangeet",
    eventType: "Sangeet",
    description: "Operations checklist for Sangeet events.",
    phases: [
      {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        tasks: [
          { title: "Confirm guest count and seating vs standing/dance-floor split", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Lock DJ, sound vendor and final playlist/medley with family", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Collect performance running order and rehearsal track list", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Confirm choreographer rehearsal slot and green-room needs", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Lock cocktail/bar menu, snacks and dinner timing with kitchen", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Verify balance payment cleared before event day", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Confirm liquor permit/excise compliance if bar is served", category: "SECURITY", priority: "HIGH", mandatory: true },
        ],
      },
      {
        name: "Venue Setup",
        phase: "SETUP",
        tasks: [
          { title: "Deep-clean hall, restrooms and performer green rooms", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Performance stage, LED wall and backdrop setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Dance floor laid, leveled and anti-slip checked", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "DJ console, line-array speakers, sub-bass and mixer setup", category: "AV", priority: "HIGH", mandatory: true, proof: true },
          { title: "Full AV sound-check with wireless mics and monitor wedges", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Intelligent lighting, moving heads, haze and follow-spot test", category: "AV", priority: "HIGH" },
          { title: "Lounge/cocktail seating and high-tables arranged", category: "GUEST_SEATING", priority: "MEDIUM" },
          { title: "Bar and live snack counters setup", category: "CATERING", priority: "HIGH" },
          { title: "Cold-pyro/sparkler gear safety clearance and DG backup check", category: "SECURITY", priority: "URGENT", mandatory: true, proof: true },
        ],
      },
      {
        name: "Guest Arrival",
        phase: "GUEST_ARRIVAL",
        tasks: [
          { title: "Reception desk and guest list ready", category: "GUEST_SEATING", priority: "MEDIUM" },
          { title: "Welcome drinks/mocktails ready at entrance", category: "CATERING", priority: "MEDIUM" },
          { title: "Performers checked into green room, mics tagged and tested", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Valet and parking coordination", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Family and VIP front-row seating coordination", category: "GUEST_SEATING", priority: "MEDIUM" },
        ],
      },
      {
        name: "During the Event",
        phase: "LIVE_EVENT",
        tasks: [
          { title: "Run performance order with DJ — track cues and transitions", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Stage hand support — props, dupattas and quick changeovers", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Lighting and haze operation per performance cues", category: "AV", priority: "HIGH" },
          { title: "Open dance floor — DJ set and crowd management", category: "ENTERTAINMENT", priority: "HIGH" },
          { title: "Bar, snacks and dinner service as per timeline", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Monitor sound levels vs noise norms and 10 PM deadline", category: "SECURITY", priority: "HIGH", mandatory: true },
          { title: "Photography/videography of performances and dance floor", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      {
        name: "Wind-Down",
        phase: "WRAP_UP",
        tasks: [
          { title: "Collect host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true },
          { title: "Power down and secure DJ/AV gear; reconcile rentals", category: "AV", priority: "HIGH" },
          { title: "Vendor settlement and sign-off checklist", category: "LOGISTICS", priority: "HIGH" },
          { title: "Clear dance floor, bar and stage; secure leftover liquor", category: "HOUSEKEEPING", priority: "MEDIUM" },
          { title: "Lost and found collection", category: "GENERAL", priority: "LOW" },
        ],
      },
      {
        name: "Handover & Closure",
        phase: "HANDOVER",
        tasks: [
          { title: "Hall and dance-floor handover with damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Final settlement and invoice closure", category: "GENERAL", priority: "HIGH" },
          { title: "Post-event report and photos archived", category: "GENERAL", priority: "LOW" },
        ],
      },
    ],
  },
  {
    name: "Mehendi",
    eventType: "Mehendi",
    description: "Operations checklist for Mehendi events.",
    phases: [
      {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        tasks: [
          { title: "Confirm guest count and number of ladies needing mehendi", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Confirm mehendi artist count, hours and bridal design brief", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Confirm organic cones stock and patch-test for bride", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Lock light snacks, chaat counter and beverages with kitchen", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Confirm dhol/folk singer or background music vendor", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Verify balance payment cleared before event day", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Circulate final run-sheet to ops team", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      {
        name: "Venue Setup",
        phase: "SETUP",
        tasks: [
          { title: "Deep-clean and sanitize the hall and restrooms", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Vibrant boho/floral decor, drapes and umbrella props setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Bridal mehendi throne/swing and special lighting setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Low cushion/floor seating and bolsters for guests arranged", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "Mehendi artist stations — chairs, stools, footrests, task lamps", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true, proof: true },
          { title: "Drying station with fans/hand-rests and tissue/lemon-sugar mix", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "AV check — background music speakers and mic", category: "AV", priority: "MEDIUM" },
          { title: "Snack/chaat counters and beverage station setup", category: "CATERING", priority: "HIGH" },
          { title: "Fire exits clear, extinguishers checked", category: "SECURITY", priority: "HIGH", mandatory: true },
        ],
      },
      {
        name: "Guest Arrival",
        phase: "GUEST_ARRIVAL",
        tasks: [
          { title: "Reception desk and guest list ready", category: "GUEST_SEATING", priority: "MEDIUM" },
          { title: "Welcome drinks and refreshing towels at entrance", category: "CATERING", priority: "MEDIUM" },
          { title: "Mehendi artists in position and token/queue system ready", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Brief ushers to guide ladies to artist stations", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Valet and parking coordination", category: "LOGISTICS", priority: "LOW" },
        ],
      },
      {
        name: "During the Event",
        phase: "LIVE_EVENT",
        tasks: [
          { title: "Prioritize and complete bridal mehendi as priority one", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true, proof: true },
          { title: "Manage guest mehendi queue and artist rotation", category: "ENTERTAINMENT", priority: "HIGH" },
          { title: "Background music / dhol and games coordination", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Continuous snack, chaat and beverage service", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Keep seating and floor free of mehendi stains — spot cleaning", category: "HOUSEKEEPING", priority: "MEDIUM" },
          { title: "Photography/videography of bridal hands and candid moments", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      {
        name: "Wind-Down",
        phase: "WRAP_UP",
        tasks: [
          { title: "Collect host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true },
          { title: "Settle mehendi artist hours/headcount and sign-off", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Vendor settlement and sign-off checklist", category: "LOGISTICS", priority: "HIGH" },
          { title: "Return rented props/seating and reconcile inventory", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Lost and found collection", category: "GENERAL", priority: "LOW" },
        ],
      },
      {
        name: "Handover & Closure",
        phase: "HANDOVER",
        tasks: [
          { title: "Hall handover and stain/damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Final settlement and invoice closure", category: "GENERAL", priority: "HIGH" },
          { title: "Post-event report and photos archived", category: "GENERAL", priority: "LOW" },
        ],
      },
    ],
  },
  {
    name: "Haldi",
    eventType: "Haldi",
    description: "Operations checklist for Haldi events.",
    phases: [
      {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        tasks: [
          { title: "Confirm guest count and haldi ceremony timing with family", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Confirm haldi paste/turmeric, flowers and ritual items prepared", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Arrange stain-safe disposable covers, raincoats and aprons", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Lock light breakfast/snacks and beverages with kitchen", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Confirm dhol/music vendor for haldi rituals", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Verify balance payment cleared before event day", category: "GENERAL", priority: "HIGH", mandatory: true },
        ],
      },
      {
        name: "Venue Setup",
        phase: "SETUP",
        tasks: [
          { title: "Deep-clean hall/lawn and restrooms", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Lay stain-safe floor covers/tarpaulin across ceremony zone", category: "HOUSEKEEPING", priority: "URGENT", mandatory: true, proof: true },
          { title: "Marigold/floral haldi decor, backdrop and matkas setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Haldi seating/stool for bride or groom with floral canopy", category: "DECOR", priority: "HIGH", mandatory: true },
          { title: "Haldi paste bowls, flower petals and ubtan thalis arranged", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Cover/wrap furniture, speakers and cables against turmeric", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "AV check — music speakers and mic (splash-protected)", category: "AV", priority: "MEDIUM" },
          { title: "Water/wash station and fresh towels for guests setup", category: "HOUSEKEEPING", priority: "HIGH" },
          { title: "Snack and beverage counter setup", category: "CATERING", priority: "MEDIUM" },
        ],
      },
      {
        name: "Guest Arrival",
        phase: "GUEST_ARRIVAL",
        tasks: [
          { title: "Welcome guests and hand out aprons/old-clothes reminders", category: "HOUSEKEEPING", priority: "MEDIUM" },
          { title: "Welcome drinks ready at entrance", category: "CATERING", priority: "MEDIUM" },
          { title: "Brief ushers on ceremony flow and bride/groom escort", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Valet and parking coordination", category: "LOGISTICS", priority: "LOW" },
        ],
      },
      {
        name: "During the Event",
        phase: "LIVE_EVENT",
        tasks: [
          { title: "Coordinate haldi application ritual sequence with family", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Dhol/music cues and games coordination", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Continuous mopping of turmeric splashes to prevent slips", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Replenish haldi paste, petals and water as needed", category: "GENERAL", priority: "MEDIUM" },
          { title: "Snack and beverage service", category: "CATERING", priority: "MEDIUM" },
          { title: "Photography/videography of haldi rituals and candids", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      {
        name: "Wind-Down",
        phase: "WRAP_UP",
        tasks: [
          { title: "Collect host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true },
          { title: "Remove and dispose stained covers; pressure-clean floor", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Vendor settlement and sign-off checklist", category: "LOGISTICS", priority: "HIGH" },
          { title: "Return rented props/seating and reconcile inventory", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Lost and found collection", category: "GENERAL", priority: "LOW" },
        ],
      },
      {
        name: "Handover & Closure",
        phase: "HANDOVER",
        tasks: [
          { title: "Hall/lawn handover with turmeric-stain and damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Final settlement and invoice closure", category: "GENERAL", priority: "HIGH" },
          { title: "Post-event report and photos archived", category: "GENERAL", priority: "LOW" },
        ],
      },
    ],
  },
  {
    name: "Anniversary",
    eventType: "Anniversary",
    description: "Operations checklist for Anniversary events.",
    phases: [
      {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        tasks: [
          { title: "Confirm final guest count and per-plate count with host", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Lock menu, cake design and per-plate count with kitchen", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Confirm theme, anniversary year decor and photo-wall/montage", category: "DECOR", priority: "MEDIUM" },
          { title: "Confirm vows-renewal / felicitation segment and stage cue", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Confirm all vendors — caterer, decor, photographer, DJ", category: "LOGISTICS", priority: "HIGH", mandatory: true },
          { title: "Verify balance payment cleared before event day", category: "GENERAL", priority: "HIGH", mandatory: true },
        ],
      },
      {
        name: "Venue Setup",
        phase: "SETUP",
        tasks: [
          { title: "Deep-clean and sanitize the hall and restrooms", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Stage, backdrop and themed decor setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Photo-montage wall / memory display and AV slideshow setup", category: "AV", priority: "MEDIUM" },
          { title: "Lay tables, chairs and VIP/family seating per floor plan", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "AV check — mics, speakers, projector and slideshow", category: "AV", priority: "HIGH", mandatory: true, proof: true },
          { title: "Lighting setup and test", category: "AV", priority: "MEDIUM" },
          { title: "Cake table, dessert counter and buffet setup", category: "CATERING", priority: "HIGH" },
          { title: "Fire exits clear, extinguishers and DG backup checked", category: "SECURITY", priority: "HIGH", mandatory: true },
          { title: "Welcome signage and directions placed", category: "LOGISTICS", priority: "LOW" },
        ],
      },
      {
        name: "Guest Arrival",
        phase: "GUEST_ARRIVAL",
        tasks: [
          { title: "Reception desk and guest list ready", category: "GUEST_SEATING", priority: "MEDIUM" },
          { title: "Welcome drinks ready at entrance", category: "CATERING", priority: "MEDIUM" },
          { title: "Family and elderly/VIP seating coordination", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "Valet and parking coordination", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Brief ushers and security on guest flow", category: "SECURITY", priority: "LOW" },
        ],
      },
      {
        name: "During the Event",
        phase: "LIVE_EVENT",
        tasks: [
          { title: "Couple entry, felicitation and vows-renewal coordination", category: "ENTERTAINMENT", priority: "HIGH" },
          { title: "Cake-cutting and toast — music and MC cue", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Memory slideshow / speeches AV support", category: "AV", priority: "MEDIUM" },
          { title: "Food and dessert service as per timeline", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Monitor AC, cleanliness and restrooms", category: "HOUSEKEEPING", priority: "MEDIUM" },
          { title: "Photography/videography coverage", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      {
        name: "Wind-Down",
        phase: "WRAP_UP",
        tasks: [
          { title: "Collect host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true },
          { title: "Hand over cake, gifts and host belongings safely", category: "GENERAL", priority: "MEDIUM" },
          { title: "Vendor settlement and sign-off checklist", category: "LOGISTICS", priority: "HIGH" },
          { title: "Return rented equipment and reconcile inventory", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Lost and found collection", category: "GENERAL", priority: "LOW" },
        ],
      },
      {
        name: "Handover & Closure",
        phase: "HANDOVER",
        tasks: [
          { title: "Hall handover and damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Final settlement and invoice closure", category: "GENERAL", priority: "HIGH" },
          { title: "Post-event report and photos archived", category: "GENERAL", priority: "LOW" },
        ],
      },
    ],
  },
  {
    name: "Product Launch",
    eventType: "Product Launch",
    description: "Operations checklist for Product Launch events.",
    phases: [
      {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        tasks: [
          { title: "Confirm expected headcount, media/press list and VIP guests", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Lock run-of-show, keynote slots and reveal sequence with client", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Collect final presentation deck, AV assets and reveal video", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Confirm branding — stage backdrop, standees, step-and-repeat wall", category: "DECOR", priority: "HIGH", mandatory: true },
          { title: "Confirm high-speed internet, livestream and recording needs", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Confirm registration desk, badges and gift hampers", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Verify balance payment cleared before event day", category: "GENERAL", priority: "HIGH", mandatory: true },
        ],
      },
      {
        name: "Venue Setup",
        phase: "SETUP",
        tasks: [
          { title: "Deep-clean and sanitize the hall and restrooms", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Stage, podium, branded backdrop and product reveal unit setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Theatre/cluster seating and media riser per floor plan", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "LED wall/projector, presentation and reveal video test", category: "AV", priority: "URGENT", mandatory: true, proof: true },
          { title: "Sound-check mics, clicker, confidence monitor and audio feed", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Internet/livestream and recording check (primary + backup)", category: "AV", priority: "HIGH", mandatory: true, proof: true },
          { title: "Stage lighting, follow-spot and reveal cue lighting test", category: "AV", priority: "MEDIUM" },
          { title: "Registration desk, badges and press kit table setup", category: "LOGISTICS", priority: "HIGH" },
          { title: "Hi-tea/canapé counters and networking lounge setup", category: "CATERING", priority: "MEDIUM" },
          { title: "Fire exits clear, extinguishers and DG backup verified", category: "SECURITY", priority: "URGENT", mandatory: true, proof: true },
        ],
      },
      {
        name: "Guest Arrival",
        phase: "GUEST_ARRIVAL",
        tasks: [
          { title: "Registration desk, badges and press accreditation ready", category: "LOGISTICS", priority: "HIGH", mandatory: true },
          { title: "Welcome drinks and networking refreshments ready", category: "CATERING", priority: "MEDIUM" },
          { title: "Usher media/VIPs to reserved seating and brief on run-of-show", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "Valet and parking coordination", category: "LOGISTICS", priority: "MEDIUM" },
          { title: "Brief security on access control and stage no-go zone", category: "SECURITY", priority: "MEDIUM" },
        ],
      },
      {
        name: "During the Event",
        phase: "LIVE_EVENT",
        tasks: [
          { title: "Run-of-show execution — cue keynote, reveal and AV per script", category: "AV", priority: "URGENT", mandatory: true },
          { title: "Product reveal moment — lighting, video and effects cue", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Livestream and recording monitored throughout", category: "AV", priority: "HIGH", mandatory: true },
          { title: "AV/presentation support and backup on standby", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Press Q&A, photo-op and demo-zone coordination", category: "GENERAL", priority: "MEDIUM" },
          { title: "Hi-tea / networking refreshment service", category: "CATERING", priority: "MEDIUM" },
          { title: "Event photography and AV coverage", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      {
        name: "Wind-Down",
        phase: "WRAP_UP",
        tasks: [
          { title: "Collect client/host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true },
          { title: "Hand over recordings, photos and press kits to client", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Secure branding assets, samples and product units", category: "LOGISTICS", priority: "HIGH" },
          { title: "Vendor settlement and sign-off checklist", category: "LOGISTICS", priority: "HIGH" },
          { title: "Return rented AV/equipment and reconcile inventory", category: "LOGISTICS", priority: "MEDIUM" },
        ],
      },
      {
        name: "Handover & Closure",
        phase: "HANDOVER",
        tasks: [
          { title: "Hall handover and damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Final settlement and invoice closure", category: "GENERAL", priority: "HIGH" },
          { title: "Post-event report, footage and photos archived", category: "GENERAL", priority: "LOW" },
        ],
      },
    ],
  },
  {
    name: "Awards Night",
    eventType: "Awards Night",
    description: "Operations checklist for Awards Night events.",
    phases: [
      {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        tasks: [
          { title: "Confirm headcount, nominee/winner list and VIP seating plan", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Lock detailed run-of-show — award sequence, hosts and cues", category: "GENERAL", priority: "HIGH", mandatory: true },
          { title: "Verify trophies/medals/certificates count and engraving", category: "LOGISTICS", priority: "HIGH", mandatory: true, proof: true },
          { title: "Collect AV cue sheet — nominee VTs, walk-on music, name supers", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Confirm host/anchor script and teleprompter content", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Confirm branding, livestream, recording and red-carpet plan", category: "AV", priority: "MEDIUM" },
          { title: "Verify balance payment cleared before event day", category: "GENERAL", priority: "HIGH", mandatory: true },
        ],
      },
      {
        name: "Venue Setup",
        phase: "SETUP",
        tasks: [
          { title: "Deep-clean and sanitize the hall, restrooms and green rooms", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true },
          { title: "Awards stage, LED wall, podium and branded backdrop setup", category: "DECOR", priority: "HIGH", mandatory: true, proof: true },
          { title: "Red carpet, step-and-repeat media wall and photo-op zone setup", category: "DECOR", priority: "MEDIUM" },
          { title: "Trophy table, holding area and presentation tray arranged", category: "LOGISTICS", priority: "HIGH", mandatory: true, proof: true },
          { title: "Round/theatre seating with name cards and VIP enclosure", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "LED wall, name supers and nominee VT playback test", category: "AV", priority: "URGENT", mandatory: true, proof: true },
          { title: "Sound-check mics, podium mic, anchor IEM and music feed", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Stage lighting, follow-spots and award-cue lighting program test", category: "AV", priority: "HIGH", mandatory: true },
          { title: "Teleprompter and confidence monitor test", category: "AV", priority: "MEDIUM" },
          { title: "Livestream/recording setup with backup", category: "AV", priority: "MEDIUM" },
          { title: "Fire exits clear, extinguishers and DG backup verified", category: "SECURITY", priority: "URGENT", mandatory: true, proof: true },
        ],
      },
      {
        name: "Guest Arrival",
        phase: "GUEST_ARRIVAL",
        tasks: [
          { title: "Registration desk, name cards and seating allocation ready", category: "GUEST_SEATING", priority: "HIGH", mandatory: true },
          { title: "Red-carpet reception and press photo-op coordination", category: "ENTERTAINMENT", priority: "MEDIUM" },
          { title: "Welcome drinks and pre-function refreshments ready", category: "CATERING", priority: "MEDIUM" },
          { title: "Usher VIPs/chief guest to reserved front rows", category: "GUEST_SEATING", priority: "HIGH" },
          { title: "Brief stage crew/ushers on winner walk-up and trophy handoff", category: "LOGISTICS", priority: "HIGH", mandatory: true },
        ],
      },
      {
        name: "During the Event",
        phase: "LIVE_EVENT",
        tasks: [
          { title: "Execute run-of-show — cue anchors, VTs, music and name supers", category: "AV", priority: "URGENT", mandatory: true },
          { title: "Stage management — winner walk-up, trophy handoff, exit flow", category: "ENTERTAINMENT", priority: "HIGH", mandatory: true },
          { title: "Trophy/certificate sequencing matches each award correctly", category: "LOGISTICS", priority: "URGENT", mandatory: true },
          { title: "Lighting and follow-spot operation per award cues", category: "AV", priority: "HIGH" },
          { title: "Livestream and recording monitored throughout", category: "AV", priority: "HIGH" },
          { title: "Dinner / cocktail service as per timeline", category: "CATERING", priority: "HIGH", mandatory: true },
          { title: "Event photography and on-stage coverage", category: "GENERAL", priority: "MEDIUM" },
        ],
      },
      {
        name: "Wind-Down",
        phase: "WRAP_UP",
        tasks: [
          { title: "Collect client/host feedback before departure", category: "GENERAL", priority: "MEDIUM", mandatory: true },
          { title: "Reconcile trophies awarded vs spare; hand over leftovers", category: "LOGISTICS", priority: "HIGH", mandatory: true },
          { title: "Hand over recordings, photos and footage to client", category: "GENERAL", priority: "HIGH" },
          { title: "Vendor settlement and sign-off checklist", category: "LOGISTICS", priority: "HIGH" },
          { title: "Return rented AV/lighting/equipment and reconcile inventory", category: "LOGISTICS", priority: "MEDIUM" },
        ],
      },
      {
        name: "Handover & Closure",
        phase: "HANDOVER",
        tasks: [
          { title: "Hall handover and damage inspection", category: "HOUSEKEEPING", priority: "HIGH", mandatory: true, proof: true },
          { title: "Final settlement and invoice closure", category: "GENERAL", priority: "HIGH" },
          { title: "Post-event report, footage and photos archived", category: "GENERAL", priority: "LOW" },
        ],
      },
    ],
  },
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
  for (const t of TEMPLATES) {
    const existing = await prisma.sOPTemplate.findFirst({ where: { name: t.name }, select: { id: true } });
    if (existing) continue;
    await prisma.sOPTemplate.create({
      data: {
        name: t.name,
        eventType: t.eventType,
        isActive: true,
        isDefault: !!t.isDefault && !hasDefault,
        phases: {
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
        },
      },
    });
    sopCreated++;
  }
  console.log(`[bootstrap] SOP templates: created ${sopCreated}, ${TEMPLATES.length - sopCreated} already present`);

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
}
