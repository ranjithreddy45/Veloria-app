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
