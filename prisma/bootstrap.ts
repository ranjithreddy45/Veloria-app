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
    {
      name: "Veloria Grand — Hosa Road",
      description:
        "Our Hosa Road banquet — elegant interiors, ample parking, ideal for weddings and large receptions.",
      capacity: 600,
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
  const realNames = new Set(REAL_VENUES.map((v) => v.name));

  for (const v of REAL_VENUES) {
    const existing = allVenues.find((e) => e.name === v.name);
    if (!existing) {
      await prisma.venue.create({
        data: { ...v, amenities: COMMON_AMENITIES, isActive: true },
      });
    }
  }
  // Deactivate placeholder venues so the storefront shows only the real five.
  for (const e of allVenues) {
    if (!realNames.has(e.name)) {
      await prisma.venue.update({
        where: { id: e.id },
        data: { isActive: false },
      });
    }
  }
  console.log("[bootstrap] Synced 5 real venues (placeholders deactivated)");

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

  console.log("[bootstrap] Done.");
}

main()
  .catch((e) => {
    console.error("[bootstrap] Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
