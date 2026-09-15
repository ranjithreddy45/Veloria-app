/**
 * Idempotent production bootstrap.
 *
 * Runs during the Vercel build (after `prisma db push`). Unlike seed.ts,
 * this NEVER deletes anything — it only creates the minimum needed for a
 * working production app if it's missing:
 *   1. A SUPER_ADMIN login
 *   2. The default sales pipeline stages
 *
 * Safe to run on every deploy.
 */
import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { seedTemplates } from "./seed-templates";

const prisma = new PrismaClient();

async function main() {
  // ---- 0. Slot uniqueness: PARTIAL unique index (excludes CANCELLED) ----
  // A cancelled booking must release its slot so the date+slot can be re-booked.
  // The old full @@unique([venueId,date,timeSlot]) kept cancelled rows holding
  // the slot (re-book hit a P2002). Replace it with a partial unique index.
  // Idempotent + non-destructive.
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_venueId_date_timeSlot_key";`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Booking_active_slot_key" ON "Booking" ("venueId", "date", "timeSlot") WHERE "status" <> 'CANCELLED';`
    );
    console.log("[bootstrap] Booking active-slot partial unique index ensured.");
  } catch (e) {
    console.error("[bootstrap] slot index setup failed (non-fatal):", e);
  }

  // ---- 0b. Vendor name uniqueness: case-insensitive unique index (non-@unique so
  // prisma db push's data-loss guard never blocks the deploy). If prod still has
  // duplicate names the CREATE fails harmlessly and is retried next deploy once the
  // /settings/duplicates finder is used to merge them. App-level create-guards
  // already prevent NEW dupes. ----
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_name_lower_key" ON "Vendor" (lower("name"));`
    );
    console.log("[bootstrap] Vendor name unique index ensured.");
  } catch (e) {
    console.warn("[bootstrap] Vendor name unique index NOT created — likely duplicate names exist; merge them via /settings/duplicates, then it applies next deploy.", (e as Error).message);
  }

  // ---- 0c. Karnataka Labour Welfare Fund on the primary payroll entity (BILLION):
  // ₹20 employee / ₹40 employer, deducted in December. Idempotent upsert. ----
  try {
    const entity = await prisma.legalEntity.findFirst({ where: { shortCode: "BILLION" }, select: { id: true } });
    if (entity) {
      const cfg = await prisma.hrStatutoryConfig.findUnique({ where: { legalEntityId: entity.id }, select: { id: true } });
      if (cfg) {
        await prisma.hrStatutoryConfig.update({
          where: { legalEntityId: entity.id },
          data: { lwfApplicable: true, lwfState: "Karnataka", lwfEmployee: 20, lwfEmployer: 40, lwfMonths: [12] },
        });
      } else {
        await prisma.hrStatutoryConfig.create({
          data: { legalEntityId: entity.id, lwfApplicable: true, lwfState: "Karnataka", lwfEmployee: 20, lwfEmployer: 40, lwfMonths: [12] },
        });
      }
      console.log("[bootstrap] Karnataka LWF (₹20/₹40, December) ensured on BILLION.");
    }
  } catch (e) {
    console.error("[bootstrap] LWF config setup failed (non-fatal):", e);
  }

  // ---- 1. Ensure a SUPER_ADMIN exists ----
  const adminEmail =
    process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@veloriagrand.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin@123";
    const hashed = await bcryptjs.hash(password, 12);
    await prisma.user.create({
      data: {
        name: "Administrator",
        email: adminEmail,
        hashedPassword: hashed,
        role: "SUPER_ADMIN",
        isActive: true,
        emailVerified: new Date(),
      },
    });
    console.log(`[bootstrap] Created SUPER_ADMIN: ${adminEmail}`);
  } else {
    console.log(`[bootstrap] Admin already exists: ${adminEmail}`);
  }

  // ---- 2. Sync the 12-stage venue booking pipeline (spec §5) ----
  // Converges to the canonical stages by name. Order is @unique, so we
  // first park existing stages at high orders, then upsert canonical ones
  // into 1..12. Legacy stages with deals are kept (parked) so no deal is
  // orphaned; empty legacy stages are removed.
  const CANONICAL_STAGES = [
    { name: "New Inquiry", probability: 10, color: "#6366f1", isDefault: true },
    { name: "Contacted", probability: 20, color: "#8b5cf6" },
    { name: "Site Visit Scheduled", probability: 30, color: "#a855f7" },
    { name: "Site Visit Done", probability: 40, color: "#c026d3" },
    { name: "Quote Sent", probability: 50, color: "#3b82f6" },
    { name: "Tentative Hold", probability: 60, color: "#0ea5e9" },
    { name: "Token Paid", probability: 75, color: "#14b8a6" },
    { name: "Contract Signed", probability: 85, color: "#f59e0b" },
    { name: "Advance Received", probability: 95, color: "#f97316" },
    { name: "Event Executed", probability: 100, color: "#10b981", isWonStage: true },
    { name: "Closed Lost", probability: 0, color: "#ef4444", isLostStage: true },
    { name: "Cancelled", probability: 0, color: "#94a3b8", isLostStage: true },
  ];
  const canonicalNames = new Set(CANONICAL_STAGES.map((s) => s.name));

  const existingStages = await prisma.pipelineStage.findMany({
    include: { _count: { select: { deals: true } } },
  });

  // Pass 1: park every existing stage at a non-conflicting high order.
  let park = 1000;
  for (const s of existingStages) {
    await prisma.pipelineStage.update({
      where: { id: s.id },
      data: { order: park++ },
    });
  }

  // Pass 2: upsert canonical stages into orders 1..12 (match by name).
  for (let i = 0; i < CANONICAL_STAGES.length; i++) {
    const c = CANONICAL_STAGES[i];
    const match = existingStages.find((s) => s.name === c.name);
    const data = {
      name: c.name,
      order: i + 1,
      color: c.color,
      probability: c.probability,
      isDefault: c.isDefault ?? false,
      isWonStage: c.isWonStage ?? false,
      isLostStage: c.isLostStage ?? false,
    };
    if (match) {
      await prisma.pipelineStage.update({ where: { id: match.id }, data });
    } else {
      await prisma.pipelineStage.create({ data });
    }
  }

  // Pass 3: remove legacy stages that aren't canonical AND have no deals.
  for (const s of existingStages) {
    if (!canonicalNames.has(s.name) && s._count.deals === 0) {
      await prisma.pipelineStage.delete({ where: { id: s.id } });
    }
  }
  console.log("[bootstrap] Synced 12-stage venue booking pipeline");

  // ---- 3. Sync the 5 real Veloria Grand venues (spec §4.3) ----
  // Adds the real venues if missing; deactivates non-matching placeholders
  // (kept, not deleted, since bookings may reference them).
  const REAL_VENUES = [
    // Hosa Road has TWO bookable halls — each is its own venue so bookings/leads
    // are attributed to the correct hall and each hall has its own calendar.
    // (The old combined "Veloria Grand — Hosa Road" is auto-deactivated below
    // since it is no longer in this list.) capacity = max seating; the range is
    // in the description. Editable per hall in Settings → Venues.
    {
      name: "Veloria Grand — Hosa Road · Pearl Hall",
      description:
        "Pearl Hall at our Hosa Road banquet — intimate hall seating 80–100 guests; elegant interiors, ample parking.",
      capacity: 100,
      pricePerSlot: 150000,
    },
    {
      name: "Veloria Grand — Hosa Road · Grand Hall",
      description:
        "Grand Hall at our Hosa Road banquet — larger hall seating 150–200 guests; ideal for big weddings and receptions.",
      capacity: 200,
      pricePerSlot: 150000,
    },
    {
      name: "Veloria Grand — Airport Road",
      description:
        "Conveniently located near the airport — perfect for corporate events, conferences, and destination weddings.",
      capacity: 500,
      pricePerSlot: 140000,
    },
    {
      name: "Veloria Grand — Brookfield",
      description:
        "A premium Brookfield venue for weddings, sangeets, and milestone celebrations.",
      capacity: 400,
      pricePerSlot: 130000,
    },
    {
      name: "Veloria Grand — JP Nagar",
      description:
        "Centrally located in JP Nagar — versatile halls for weddings, engagements, and family functions.",
      capacity: 350,
      pricePerSlot: 120000,
    },
    {
      name: "Veloria Grand — Dairy Circle Road",
      description:
        "An intimate Dairy Circle venue for birthdays, anniversaries, and corporate gatherings.",
      capacity: 250,
      pricePerSlot: 100000,
    },
  ];
  const COMMON_AMENITIES = [
    "Air-conditioned halls",
    "Ample parking & valet",
    "In-house Veg / Non-Veg / Jain catering",
    "Stage, sound & lighting",
    "Bridal / green room",
    "Outside decorators welcome",
  ];

  const allVenues = await prisma.venue.findMany({ select: { id: true, name: true } });

  for (const v of REAL_VENUES) {
    const existing = allVenues.find((e) => e.name === v.name);
    if (!existing) {
      await prisma.venue.create({
        data: { ...v, amenities: COMMON_AMENITIES, isActive: true },
      });
    }
  }

  // One-time capacity correction for the two Hosa halls (first seeded with a 300
  // placeholder). Only updates while still at the placeholder, so a later manual
  // edit in Settings → Venues is never overwritten on subsequent deploys.
  const HALL_CAPACITY: Record<string, number> = {
    "Veloria Grand — Hosa Road · Pearl Hall": 100,
    "Veloria Grand — Hosa Road · Grand Hall": 200,
  };
  for (const [name, capacity] of Object.entries(HALL_CAPACITY)) {
    await prisma.venue.updateMany({
      where: { name, capacity: 300 },
      data: { capacity },
    });
  }

  // Retire ONLY explicitly-named legacy venues (NOT every non-real venue) —
  // otherwise venues added later via Settings → Venues would be silently
  // deactivated on the next deploy. Already-inactive placeholders stay inactive.
  const RETIRED_VENUE_NAMES = new Set<string>([
    "Veloria Grand — Hosa Road", // split into · Pearl Hall + · Grand Hall
  ]);
  for (const e of allVenues) {
    if (RETIRED_VENUE_NAMES.has(e.name)) {
      await prisma.venue.update({
        where: { id: e.id },
        data: { isActive: false },
      });
    }
  }
  console.log("[bootstrap] Synced real venues; retired legacy venue names");

  // ---- 3b. Seed email templates (spec §8) — idempotent by name ----
  const TEMPLATES = [
    {
      name: "Inquiry Acknowledgement",
      subject: "Thank you for your Veloria Grand inquiry",
      category: "Inquiry",
      htmlContent:
        "<p>Hi {{firstName}},</p><p>Thank you for reaching out to Veloria Grand. We've received your inquiry and our venue manager will call you shortly to discuss your event.</p><p>We offer 5 venues across Bangalore, capacity 100–1000 guests, in-house Veg / Non-Veg / Jain catering, and end-to-end coordination.</p><p>— Team Veloria Grand</p>",
    },
    {
      name: "Quote Follow-up D1",
      subject: "Following up on your Veloria Grand proposal",
      category: "Inquiry",
      htmlContent:
        "<p>Hi {{firstName}},</p><p>Just checking in on the proposal we shared. Any questions on pricing or services? Reply or call to confirm and we'll hold your date.</p><p>— Team Veloria Grand</p>",
    },
    {
      name: "Booking Confirmation",
      subject: "Your Veloria Grand booking is confirmed",
      category: "Booking",
      htmlContent:
        "<p>Dear {{firstName}},</p><p>Your booking <strong>{{bookingNumber}}</strong> is confirmed. Our coordinator will reach out 7 days before the event to finalise details.</p><p>— Team Veloria Grand</p>",
    },
    {
      name: "Pre-event Reminder",
      subject: "See you tomorrow at Veloria Grand",
      category: "Booking",
      htmlContent:
        "<p>Hi {{firstName}},</p><p>Your event is tomorrow. Reporting time: 30 minutes before start. Parking is available on-site. We look forward to hosting you.</p><p>— Team Veloria Grand</p>",
    },
    {
      name: "Post-event NPS",
      subject: "How was your event at Veloria Grand?",
      category: "Booking",
      htmlContent:
        "<p>Hi {{firstName}},</p><p>We hope your event was everything you wished for. Your feedback helps us improve — would you rate your experience? If anything fell short, just reply and we'll make it right.</p><p>— Ranjith, Veloria Grand</p>",
    },
  ];
  for (const t of TEMPLATES) {
    const exists = await prisma.emailTemplate.findFirst({
      where: { name: t.name },
    });
    if (!exists) await prisma.emailTemplate.create({ data: t });
  }
  console.log("[bootstrap] Seeded email templates");

  // ---- 3c. Seed workflow automations (spec §6) — idempotent by name ----
  // Wired to the real workflow engine + triggers. Rule 2 (status→Contacted)
  // needs a status-change trigger we don't have yet — omitted for now.
  const WORKFLOWS: {
    name: string;
    trigger:
      | "LEAD_CREATED"
      | "BOOKING_CONFIRMED"
      | "EVENT_TOMORROW"
      | "POST_EVENT";
    actions: { type: string; config: Record<string, unknown> }[];
  }[] = [
    {
      name: "Inquiry Acknowledgement",
      trigger: "LEAD_CREATED",
      actions: [
        { type: "SEND_EMAIL", config: { template: "Inquiry Acknowledgement", to: "contact" } },
        { type: "CREATE_TASK", config: { title: "Call new inquiry within 15 minutes" } },
      ],
    },
    {
      name: "Booking Confirmation",
      trigger: "BOOKING_CONFIRMED",
      actions: [
        { type: "SEND_EMAIL", config: { template: "Booking Confirmation", to: "contact" } },
      ],
    },
    {
      name: "Pre-event Reminder",
      trigger: "EVENT_TOMORROW",
      actions: [
        { type: "SEND_EMAIL", config: { template: "Pre-event Reminder", to: "contact" } },
      ],
    },
    {
      name: "Post-event NPS",
      trigger: "POST_EVENT",
      actions: [
        { type: "SEND_EMAIL", config: { template: "Post-event NPS", to: "contact" } },
      ],
    },
  ];
  for (const w of WORKFLOWS) {
    const exists = await prisma.workflow.findFirst({ where: { name: w.name } });
    if (!exists) {
      await prisma.workflow.create({
        data: {
          name: w.name,
          trigger: w.trigger,
          // Json[] column — cast through unknown
          actions: w.actions as unknown as object[],
          isActive: true,
        },
      });
    }
  }
  console.log("[bootstrap] Seeded workflow automations");

  // ---- 4. Demo guest account (so the customer portal can be tested) ----
  // Creates a CLIENT login + a matching Contact + one sample booking, so
  // logging in as the guest shows a populated "My Bookings". Idempotent.
  const guestEmail = "guest@theveloriagrand.com";
  const existingGuest = await prisma.user.findUnique({
    where: { email: guestEmail },
  });

  if (!existingGuest) {
    const guestPassword = await bcryptjs.hash(
      process.env.DEMO_GUEST_PASSWORD || "Guest@123",
      12
    );
    await prisma.user.create({
      data: {
        name: "Demo Guest",
        email: guestEmail,
        hashedPassword: guestPassword,
        role: "CLIENT",
        isActive: true,
        emailVerified: new Date(),
      },
    });

    // Matching contact (portal links bookings to the user's email)
    const guestContact = await prisma.contact.create({
      data: {
        firstName: "Demo",
        lastName: "Guest",
        email: guestEmail,
        phone: "+91 90000 00000",
        type: "INDIVIDUAL",
      },
    });

    // A sample confirmed booking, 45 days out, in the first venue
    const venue = await prisma.venue.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      select: { id: true },
    });
    if (venue && admin) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 45);
      await prisma.booking.create({
        data: {
          bookingNumber: `VG-DEMO-${Date.now().toString().slice(-6)}`,
          eventName: "Demo Guest's Reception",
          eventType: "Reception",
          date: eventDate,
          timeSlot: "EVENING",
          guestCount: 180,
          totalAmount: 250000,
          status: "CONFIRMED",
          venueId: venue.id,
          contactId: guestContact.id,
          createdById: admin.id,
          specialRequests:
            "Sample booking created for portal demo. Safe to delete.",
        },
      });
    }
    console.log(`[bootstrap] Created demo guest: ${guestEmail}`);
  } else {
    console.log(`[bootstrap] Demo guest already exists: ${guestEmail}`);
  }

  // ---- 5. Seed sample hall owners (B2B funnel, spec §13) ----
  const ownerCount = await prisma.hallOwner.count();
  if (ownerCount === 0) {
    const bd = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
      select: { id: true },
    });
    await prisma.hallOwner.createMany({
      data: [
        {
          ownerName: "Rajesh Hegde",
          companyName: "Hegde Convention Centre",
          email: "rajesh@hegdeconvention.in",
          phone: "+91 98450 11223",
          propertyCity: "Bangalore",
          propertyType: "CONVENTION_CENTER",
          ownershipStatus: "SELF_OWNED",
          numberOfHalls: 2,
          totalCapacity: 800,
          commercialModel: "REVENUE_SHARE",
          revenueSharePercent: 12,
          contractStatus: "NEGOTIATION",
          bdOwnerId: bd?.id ?? null,
        },
        {
          ownerName: "Lakshmi Estates",
          companyName: "Lakshmi Marriage Gardens",
          email: "contact@lakshmigardens.in",
          phone: "+91 97400 55667",
          propertyCity: "Mysuru",
          propertyType: "MARRIAGE_GARDEN",
          ownershipStatus: "FAMILY_PROPERTY",
          numberOfHalls: 1,
          totalCapacity: 1000,
          commercialModel: "HYBRID",
          revenueSharePercent: 10,
          minimumMonthlyGuarantee: 200000,
          contractStatus: "SITE_INSPECTION",
          bdOwnerId: bd?.id ?? null,
        },
        {
          ownerName: "Imperial Banquets",
          companyName: "Imperial Hospitality LLP",
          email: "owner@imperialbanquets.in",
          phone: "+91 99000 44556",
          propertyCity: "Bangalore",
          propertyType: "BANQUET_HALL",
          ownershipStatus: "LEASED",
          numberOfHalls: 3,
          totalCapacity: 600,
          commercialModel: "MANAGEMENT_FEE",
          contractStatus: "PROSPECT",
          bdOwnerId: bd?.id ?? null,
        },
      ],
    });
    console.log("[bootstrap] Seeded 3 sample hall owners");
  } else {
    console.log(`[bootstrap] Hall owners already exist (${ownerCount})`);
  }

  // ---- 6. Seed default approval rules (sign-off thresholds) ----
  // These make the Approvals queue functional out of the box. Each rule
  // is keyed by name; we only create it if it doesn't already exist, so
  // admins can freely edit/disable them without the bootstrap clobbering
  // their changes on the next deploy.
  const approver = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });

  if (approver) {
    const DEFAULT_RULES: {
      name: string;
      entityType: string;
      description: string;
      conditions: { field: string; operator: string; value: number }[];
    }[] = [
      {
        name: "High-discount quote sign-off",
        entityType: "QUOTE",
        description:
          "Quotes discounted more than 20% must be approved before they can be sent to the customer.",
        conditions: [{ field: "discountPercent", operator: "gt", value: 20 }],
      },
      {
        name: "Large deal sign-off",
        entityType: "DEAL",
        description:
          "Deals worth ₹15,00,000 or more require managerial sign-off when marked Won.",
        conditions: [{ field: "value", operator: "gte", value: 1500000 }],
      },
      {
        name: "High-value booking review",
        entityType: "BOOKING",
        description:
          "Bookings of ₹10,00,000 or more are flagged for managerial review.",
        conditions: [{ field: "totalAmount", operator: "gte", value: 1000000 }],
      },
    ];

    let createdRules = 0;
    for (const r of DEFAULT_RULES) {
      const exists = await prisma.approvalRule.findFirst({
        where: { name: r.name },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.approvalRule.create({
        data: {
          name: r.name,
          entityType: r.entityType,
          description: r.description,
          isActive: true,
          priority: 0,
          conditions: r.conditions,
          approverChain: {
            create: [
              {
                order: 0,
                // Assign to the concrete admin user so the request reliably
                // lands in their queue regardless of role-name conventions.
                approverType: "USER",
                approverId: approver.id,
                isOptional: false,
              },
            ],
          },
        },
      });
      createdRules++;
    }
    if (createdRules > 0) {
      console.log(`[bootstrap] Seeded ${createdRules} default approval rule(s)`);
    } else {
      console.log("[bootstrap] Approval rules already present");
    }
  }

  // ---- 7. Seed BD / Acquisition CRM config + sample data ----
  const ACQ_CONFIG_SEED: Record<string, string> = {
    MANAGEMENT_BASE_FEE_FLOOR_PCT: "5",
    MANAGEMENT_INCENTIVE_FLOOR_PCT: "15",
    FRANCHISE_ROYALTY_FLOOR_PCT: "20",
    MIN_LOCKIN_YEARS: "3",
    LEAD_FIRST_CONTACT_SLA_HOURS: "24",
    LEAD_MIN_ATTEMPTS_BEFORE_DISQUALIFY: "3",
    LEAD_DISQUALIFY_WINDOW_DAYS: "5",
    ONBOARDING_SLA_DAYS: "7",
    REENGAGE_DAYS: "90",
    EVALUATION_PASS_THRESHOLD: "70",
    // Owner Projection Calculator — tunable §3 assumptions (defaults = oracle).
    PROJ_EVENTS_RAMP: "1,1.3,1.3,1.1,1.1",
    PROJ_EVENTS_MAX_YEAR3: "40",
    PROJ_EVENTS_MAX_YEAR3_BEST: "45",
    PROJ_BASE_FEE_PCT: "0.05",
    PROJ_INCENTIVE_PCT: "0.2",
    PROJ_OPEX_YOY_GROWTH: "1.3",
    PROJ_WITHOUTFOOD_REV_YOY: "1.05",
    PROJ_WITHFOOD_PLATE_YOY: "1.1",
    PROJ_FOOD_COST_PER_PLATE: "250",
    PROJ_HALL_CHARGE_DEFAULT: "6999",
    PROJ_HOURS_PER_EVENT_DEFAULT: "4",
    PROJ_BEST_CASE_PLATE_UPLIFT: "100",
    PROJ_REQUIRE_SECOND_APPROVER: "true",
  };
  let acqCfgCreated = 0;
  for (const [key, value] of Object.entries(ACQ_CONFIG_SEED)) {
    const exists = await prisma.acqConfig.findUnique({ where: { key } });
    if (!exists) {
      await prisma.acqConfig.create({ data: { key, value } });
      acqCfgCreated++;
    }
  }
  if (acqCfgCreated > 0) console.log(`[bootstrap] Seeded ${acqCfgCreated} BD config value(s)`);

  // ---- 7b. Lead source WALK_IN → INCOMING_LEAD (BD item 7) ----
  // The value was renamed; WALK_IN stays declared in the Prisma enum only so
  // not-yet-migrated rows remain readable. Idempotent: once every row is
  // migrated the updateMany matches nothing and this logs 0. Non-fatal.
  try {
    const migrated = await prisma.acqLead.updateMany({
      where: { leadSource: "WALK_IN" },
      data: { leadSource: "INCOMING_LEAD" },
    });
    console.log(`[bootstrap] BD lead source WALK_IN → INCOMING_LEAD: ${migrated.count} row(s) migrated`);
  } catch (e) {
    console.error("[bootstrap] BD lead-source migration failed (non-fatal):", e);
  }

  const acqLeadCount = await prisma.acqLead.count();
  if (acqLeadCount === 0 && approver) {
    const due = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.acqLead.createMany({
      data: [
        {
          ownerName: "Suresh Rao", mobilePrimary: "+919900112233",
          propertyName: "Rao Grand Convention", propertyType: "CONVENTION_CENTRE",
          city: "Bangalore", locality: "Whitefield", seatingTheatre: 800, seatingFloating: 1200,
          leadSource: "REFERRAL", ownerType: "SOLE_OWNER", bdExecutiveId: approver.id,
          status: "NEW", firstContactDue: due,
        },
        {
          ownerName: "Meena Iyer", mobilePrimary: "+919812345678",
          propertyName: "Iyer Marriage Palace", propertyType: "MARRIAGE_HALL",
          city: "Mysuru", locality: "Vijayanagar", seatingTheatre: 500, seatingFloating: 700,
          leadSource: "BROKER", ownerType: "PARTNER", bdExecutiveId: approver.id,
          status: "NEW", firstContactDue: due,
        },
        {
          ownerName: "Anil Kapoor", mobilePrimary: "+919845567890",
          propertyName: "Greenfield Lawns", propertyType: "LAWN",
          city: "Bangalore", locality: "Sarjapur", seatingTheatre: 0, seatingFloating: 1500,
          leadSource: "WEBSITE", ownerType: "GPA_HOLDER", bdExecutiveId: approver.id,
          status: "NEW", firstContactDue: due,
        },
      ],
    });
    console.log("[bootstrap] Seeded 3 sample acquisition leads");
  }

  // ---- Seed ready-to-use SOP + email templates (idempotent) ----
  // Non-essential: a seeding error must NEVER fail the production deploy.
  try {
    await seedTemplates(prisma);
  } catch (e) {
    console.error("[bootstrap] template seeding failed (non-fatal):", e);
  }

  // ---- Backfill blank function sheets (idempotent; runs AFTER seedTemplates so
  // template beoDefaults exist). Only touches BEOs with no notes — never an
  // already-edited one. Fills historical empty sheets with menu + notes + run-of-show.
  try {
    const { backfillEmptyBeos } = await import("../src/lib/ops/beo-content");
    const r = await backfillEmptyBeos();
    console.log(`[bootstrap] Function sheets backfilled: ${r.filled} populated of ${r.scanned} blank`);
  } catch (e) {
    console.error("[bootstrap] BEO backfill failed (non-fatal):", e);
  }

  // ---- Seed the Employee Handbook v1.1 into the HR-managed document store ----
  // Runs ONCE: only when no HANDBOOK document exists AND no handbook_* activity
  // was ever logged — so if HR deliberately removed the handbook, a redeploy
  // must NOT resurrect it. Non-fatal like every other seed.
  try {
    const existingHandbook = await prisma.document.findFirst({
      where: { category: "HANDBOOK" },
      select: { id: true },
    });
    const everManaged = await prisma.activityLog.findFirst({
      where: { action: { in: ["handbook_uploaded", "handbook_removed"] } },
      select: { id: true },
    });
    if (!existingHandbook && !everManaged) {
      const fs = await import("fs");
      const path = await import("path");
      const pdfPath = path.join(process.cwd(), "public", "hr", "employee-handbook-v1.1.pdf");
      if (fs.existsSync(pdfPath)) {
        const bytes = fs.readFileSync(pdfPath);
        await prisma.document.create({
          data: {
            name: "Employee Handbook v1.1",
            fileName: "employee-handbook-v1.1.pdf",
            mimeType: "application/pdf",
            size: bytes.length,
            category: "HANDBOOK",
            url: `data:application/pdf;base64,${bytes.toString("base64")}`,
            isPublic: false,
            tags: ["hr", "handbook"],
          },
        });
        console.log("[bootstrap] Employee Handbook v1.1 seeded into document store");
      }
    }
  } catch (e) {
    console.error("[bootstrap] handbook seeding failed (non-fatal):", e);
  }

  // ---- Leave policy 2026-09: retire Casual Leave, Sick Leave 12 → 6 ----
  // Runs ONCE (ActivityLog marker), so if HR later re-activates CL or changes
  // SL on purpose, a redeploy must NOT undo their decision. Every write is
  // additionally value-guarded, so a partial first run heals on the next one.
  try {
    const MARKER = "leave_policy_cl_removed_sl6";
    const done = await prisma.activityLog.findFirst({
      where: { action: MARKER },
      select: { id: true },
    });
    if (!done) {
      const year = new Date().getFullYear();
      // 1) Retire Casual Leave — deactivate, never delete: past requests and
      //    used balances stay on record; ensureBalances/apply skip inactive types.
      const cl = await prisma.leaveType.updateMany({
        where: { code: "CL", isActive: true },
        data: { isActive: false },
      });
      // 2) Remove untouched CL balance rows (pure provisioning artifacts) so no
      //    Casual card lingers on employee dashboards. Rows with any usage,
      //    pending days or carry-forward are kept — that history is real.
      const clBalances = await prisma.leaveBalance.deleteMany({
        where: {
          leaveType: { code: "CL" },
          used: 0,
          pending: 0,
          carriedForward: 0,
        },
      });
      // 3) Sick Leave entitlement 12 → 6 — only where still at the old default,
      //    so a manually adjusted figure is never clobbered.
      const sl = await prisma.leaveType.updateMany({
        where: { code: "SL", accrualPerYear: 12 },
        data: { accrualPerYear: 6 },
      });
      const slBalances = await prisma.leaveBalance.updateMany({
        where: { leaveType: { code: "SL" }, year, entitled: 12 },
        data: { entitled: 6 },
      });
      const admin = await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN", isActive: true },
        select: { id: true },
      });
      if (admin) {
        await prisma.activityLog.create({
          data: {
            action: MARKER,
            entityType: "leaveType",
            entityId: "policy-2026-09",
            userId: admin.id,
            changes: {
              clDeactivated: cl.count,
              clBalancesRemoved: clBalances.count,
              slTypeUpdated: sl.count,
              slBalancesUpdated: slBalances.count,
              year,
            },
          },
        });
      }
      console.log(
        `[bootstrap] Leave policy applied: CL deactivated=${cl.count}, CL balances removed=${clBalances.count}, SL type 12→6=${sl.count}, SL ${year} balances 12→6=${slBalances.count}`
      );
    }
  } catch (e) {
    console.error("[bootstrap] leave policy migration failed (non-fatal):", e);
  }

  // ---- Release logins held by archived employees ----
  // archiveEmployee now clears userId, but rows archived before that fix still
  // hold their login — and Employee.userId is @unique, so each one silently
  // blocks that login from ever being linked to a new employee record.
  // Naturally idempotent (an archived employee should never hold a login).
  try {
    const released = await prisma.employee.updateMany({
      where: { deletedAt: { not: null }, userId: { not: null } },
      data: { userId: null },
    });
    if (released.count > 0) {
      console.log(`[bootstrap] Released ${released.count} login(s) held by archived employees`);
    }
  } catch (e) {
    console.error("[bootstrap] archived-login release failed (non-fatal):", e);
  }

  // ============================================================
  // ---- Database unique guards (src/lib/dedup/unique-guards.ts) ----
  // Partial, expression-based UNIQUE indexes on the normalised phone/email
  // keys of Contact / Vendor / HallOwner. Kept OUT of schema.prisma on
  // purpose: a @unique on a table that already holds duplicates makes
  // `prisma db push` fail and blocks every deploy. Here a guard is applied
  // only once its table is clean (0 duplicate groups); otherwise it is skipped
  // with a log line and retried next deploy after /settings/duplicates has
  // been used to merge. Guards with autoApply=false are status-only here —
  // an admin applies them from /settings/duplicates. CONCURRENTLY cannot run
  // inside a transaction block, so every statement is a single autocommit
  // $executeRawUnsafe (never $transaction). A failed CONCURRENTLY build leaves
  // an INVALID index that IF NOT EXISTS would keep forever, so one is dropped
  // before the retry. Outcomes go to ActivityLog (UNIQUE_GUARD_CHECK) only
  // when a guard was actually evaluated — a valid index is its own record.
  // ============================================================
  try {
    const { GUARDS, createIndexSql, dropIndexSql, duplicateCountSql, indexStatusSql } = await import(
      "../src/lib/dedup/unique-guards"
    );
    const guardAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { id: true },
    });
    for (const guard of GUARDS) {
      try {
        const [status] = await prisma.$queryRawUnsafe<{ valid: boolean }[]>(indexStatusSql(guard));
        if (status?.valid) continue; // already protected
        if (status && !status.valid) {
          await prisma.$executeRawUnsafe(dropIndexSql(guard));
          console.warn(`[bootstrap] unique guard ${guard.name}: dropped invalid leftover index ${guard.indexName}`);
        }
        const [count] = await prisma.$queryRawUnsafe<{ groups: number }[]>(duplicateCountSql(guard));
        const duplicates = Number(count?.groups ?? 0);
        let indexCreated = false;
        if (duplicates > 0) {
          console.warn(`[bootstrap] unique guard ${guard.name} skipped: ${duplicates} duplicate groups`);
        } else if (!guard.autoApply) {
          console.log(`[bootstrap] unique guard ${guard.name} is clean but manual-apply — apply it from /settings/duplicates`);
        } else {
          await prisma.$executeRawUnsafe(createIndexSql(guard));
          indexCreated = true;
          console.log(`[bootstrap] unique guard ${guard.name} applied (${guard.indexName})`);
        }
        if (guardAdmin) {
          await prisma.activityLog.create({
            data: {
              action: "UNIQUE_GUARD_CHECK",
              entityType: "SYSTEM",
              entityId: guard.name,
              userId: guardAdmin.id,
              changes: { duplicates, indexCreated, autoApply: guard.autoApply, source: "bootstrap" },
            },
          });
        }
      } catch (e) {
        console.error(`[bootstrap] unique guard ${guard.name} failed (non-fatal):`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error("[bootstrap] unique guards failed (non-fatal):", e);
  }

  console.log("[bootstrap] Done.");
}

main()
  .catch((e) => {
    console.error("[bootstrap] Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
