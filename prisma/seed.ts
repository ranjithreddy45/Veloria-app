import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";
import {
  addDays,
  addMonths,
  subMonths,
  subDays,
  startOfMonth,
  addHours,
} from "date-fns";

const prisma = new PrismaClient();

// ============================================================
// Helpers
// ============================================================

async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const prefixes = ["98", "97", "96", "95", "94", "93", "91", "90", "88", "87"];
  return `+91 ${randomElement(prefixes)}${String(randomInt(10000000, 99999999)).padStart(8, "0")}`;
}

// ============================================================
// Seed Data
// ============================================================

const now = new Date();

async function main() {
  // Safety guard: prevent running in production
  if (process.env.NODE_ENV === "production") {
    console.error("❌ SEED ABORTED: Cannot run seed in production environment.");
    console.error("   Set NODE_ENV to 'development' or 'test' to seed the database.");
    process.exit(1);
  }

  console.log("🌱 Seeding database...");
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("Seeding Veloria Grand database...\n");

  // ============================================================
  // 1. Delete all existing data (reverse dependency order)
  // ============================================================
  console.log("Cleaning existing data...");

  await prisma.$transaction([
    // Tier 3: AI & Intelligence
    prisma.anomalyAlert.deleteMany(),
    // Tier 2: Process Intelligence
    prisma.emailTrackingEvent.deleteMany(),
    prisma.emailTrackingPixel.deleteMany(),
    prisma.webformSubmission.deleteMany(),
    prisma.webform.deleteMany(),
    prisma.approvalDecision.deleteMany(),
    prisma.approvalRequest.deleteMany(),
    prisma.approvalChainStep.deleteMany(),
    prisma.approvalRule.deleteMany(),
    prisma.cadenceEnrollmentStep.deleteMany(),
    prisma.cadenceEnrollment.deleteMany(),
    prisma.cadenceStep.deleteMany(),
    prisma.cadence.deleteMany(),
    prisma.blueprintTransitionLog.deleteMany(),
    prisma.blueprintTransition.deleteMany(),
    prisma.blueprint.deleteMany(),
    prisma.scoringRule.deleteMany(),
    prisma.scoringRuleSet.deleteMany(),
    // CRM Power Tools (SavedView, Macro, AssignmentRule)
    prisma.savedView.deleteMany(),
    prisma.macro.deleteMany(),
    prisma.assignmentRule.deleteMany(),
    // Workflows & Emergency (no FK deps on other tables)
    prisma.workflowLog.deleteMany(),
    prisma.workflow.deleteMany(),
    prisma.emergencyIncident.deleteMany(),
    prisma.emergencyProtocol.deleteMany(),
    // Analytics & Standalone (no cascading deps)
    prisma.surveyAnswer.deleteMany(),
    prisma.surveyResponse.deleteMany(),
    prisma.surveyQuestion.deleteMany(),
    prisma.survey.deleteMany(),
    prisma.review.deleteMany(),
    prisma.forecastEntry.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.competitor.deleteMany(),
    prisma.galleryItem.deleteMany(),
    prisma.document.deleteMany(),
    prisma.widgetInquiry.deleteMany(),
    // Marketing
    prisma.loyaltyTransaction.deleteMany(),
    prisma.loyaltyAccount.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.emailTemplate.deleteMany(),
    prisma.communication.deleteMany(),
    prisma.whatsAppMessage.deleteMany(),
    // Sales (Quotes & Contracts)
    prisma.quoteLineItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.contractTemplate.deleteMany(),
    // Catalog
    prisma.bookingMenuSelection.deleteMany(),
    prisma.bookingMenu.deleteMany(),
    prisma.menuTasting.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.packageItem.deleteMany(),
    prisma.eventPackage.deleteMany(),
    prisma.rentalBooking.deleteMany(),
    prisma.rentalItem.deleteMany(),
    prisma.inventoryReservation.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.pricingRule.deleteMany(),
    prisma.ratePlan.deleteMany(),
    // Finance (Payouts, Commissions, Insurance)
    prisma.payout.deleteMany(),
    prisma.commissionEntry.deleteMany(),
    prisma.commissionRule.deleteMany(),
    prisma.insurancePolicy.deleteMany(),
    // Operations (Resources, Staff)
    prisma.resourceAllocation.deleteMany(),
    prisma.resource.deleteMany(),
    prisma.staffAssignment.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.payrollEntry.deleteMany(),
    prisma.staffProfile.deleteMany(),
    // Guest Invitations & Reminders (delete first — depend on guests/bookings)
    prisma.guestReminder.deleteMany(),
    prisma.guestInvitation.deleteMany(),
    prisma.reminderTemplate.deleteMany(),
    // Event Execution & Accountability models (delete first — depend on bookings/users)
    prisma.escalation.deleteMany(),
    prisma.escalationRule.deleteMany(),
    prisma.taskTimeLog.deleteMany(),
    prisma.taskProof.deleteMany(),
    prisma.executionChecklist.deleteMany(),
    prisma.executionTask.deleteMany(),
    prisma.executionPhase.deleteMany(),
    prisma.executionPlan.deleteMany(),
    prisma.sOPTaskDefinition.deleteMany(),
    prisma.sOPPhase.deleteMany(),
    prisma.sOPTemplate.deleteMany(),
    prisma.performanceScore.deleteMany(),
    prisma.badge.deleteMany(),
    prisma.performanceIncentive.deleteMany(),
    prisma.referralReward.deleteMany(),
    prisma.referralRewardRule.deleteMany(),
    prisma.referralAsset.deleteMany(),
    // Referral & Vendor dependencies
    prisma.referral.deleteMany(),
    prisma.bookingVendor.deleteMany(),
    prisma.vendorBid.deleteMany(),
    prisma.vendor.deleteMany(),
    // Original models
    prisma.activityLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.checklistItem.deleteMany(),
    prisma.task.deleteMany(),
    prisma.taskTemplate.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.installment.deleteMany(),
    prisma.invoiceLineItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.blackoutDate.deleteMany(),
    prisma.venue.deleteMany(),
    prisma.deal.deleteMany(),
    prisma.pipelineStage.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Existing data cleaned.\n");

  // ============================================================
  // 2. Create Users
  // ============================================================
  console.log("Creating users...");

  const [
    adminPassword,
    opsPassword,
    salesPassword,
    eventsPassword,
    financePassword,
    staffPassword,
    clientPassword,
  ] = await Promise.all([
    hashPassword("Admin@123"),
    hashPassword("Admin@123"),
    hashPassword("Sales@123"),
    hashPassword("Events@123"),
    hashPassword("Finance@123"),
    hashPassword("Staff@123"),
    hashPassword("Client@123"),
  ]);

  const superAdmin = await prisma.user.create({
    data: {
      name: "Rajesh Kumar",
      email: "admin@veloriagrand.com",
      hashedPassword: adminPassword,
      phone: "+91 9876543210",
      role: "SUPER_ADMIN",
      isActive: true,
      emailVerified: now,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Priya Sharma",
      email: "ops@veloriagrand.com",
      hashedPassword: opsPassword,
      phone: "+91 9876543211",
      role: "ADMIN",
      isActive: true,
      emailVerified: now,
    },
  });

  const salesExec1 = await prisma.user.create({
    data: {
      name: "Amit Patel",
      email: "sales1@veloriagrand.com",
      hashedPassword: salesPassword,
      phone: "+91 9876543212",
      role: "SALES_EXEC",
      isActive: true,
      emailVerified: now,
    },
  });

  const salesExec2 = await prisma.user.create({
    data: {
      name: "Neha Gupta",
      email: "sales2@veloriagrand.com",
      hashedPassword: salesPassword,
      phone: "+91 9876543213",
      role: "SALES_EXEC",
      isActive: true,
      emailVerified: now,
    },
  });

  const eventCoordinator = await prisma.user.create({
    data: {
      name: "Vikram Singh",
      email: "events@veloriagrand.com",
      hashedPassword: eventsPassword,
      phone: "+91 9876543214",
      role: "EVENT_COORDINATOR",
      isActive: true,
      emailVerified: now,
    },
  });

  const finance = await prisma.user.create({
    data: {
      name: "Anita Desai",
      email: "finance@veloriagrand.com",
      hashedPassword: financePassword,
      phone: "+91 9876543215",
      role: "FINANCE",
      isActive: true,
      emailVerified: now,
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: "Ravi Verma",
      email: "staff@veloriagrand.com",
      hashedPassword: staffPassword,
      phone: "+91 9876543216",
      role: "STAFF",
      isActive: true,
      emailVerified: now,
    },
  });

  const client = await prisma.user.create({
    data: {
      name: "Suresh Mehta",
      email: "client@example.com",
      hashedPassword: clientPassword,
      phone: "+91 9876543217",
      role: "CLIENT",
      isActive: true,
      emailVerified: now,
    },
  });

  const allUsers = [superAdmin, admin, salesExec1, salesExec2, eventCoordinator, finance, staff, client];
  const salesExecs = [salesExec1, salesExec2];
  const internalUsers = [superAdmin, admin, salesExec1, salesExec2, eventCoordinator, finance, staff];

  console.log(`Created ${allUsers.length} users.\n`);

  // ============================================================
  // 3. Create Pipeline Stages
  // ============================================================
  console.log("Creating pipeline stages...");

  const stages = await prisma.$transaction([
    prisma.pipelineStage.create({
      data: { name: "New Inquiry", order: 1, color: "#6366f1", isDefault: true },
    }),
    prisma.pipelineStage.create({
      data: { name: "Site Visit", order: 2, color: "#8b5cf6" },
    }),
    prisma.pipelineStage.create({
      data: { name: "Proposal Sent", order: 3, color: "#3b82f6" },
    }),
    prisma.pipelineStage.create({
      data: { name: "Negotiation", order: 4, color: "#f59e0b" },
    }),
    prisma.pipelineStage.create({
      data: { name: "Won", order: 5, color: "#10b981", isWonStage: true },
    }),
    prisma.pipelineStage.create({
      data: { name: "Lost", order: 6, color: "#ef4444", isLostStage: true },
    }),
  ]);

  console.log(`Created ${stages.length} pipeline stages.\n`);

  // ============================================================
  // 4. Create Venues
  // ============================================================
  console.log("Creating venues...");

  const grandBallroom = await prisma.venue.create({
    data: {
      name: "Grand Ballroom",
      description: "Our flagship venue featuring elegant chandeliers, marble flooring, and a grand stage. Perfect for weddings, receptions, and large corporate events.",
      capacity: 500,
      pricePerSlot: 250000,
      amenities: ["AC", "Stage", "Parking", "WiFi", "DJ Setup", "Green Room", "Bridal Suite"],
      isActive: true,
    },
  });

  const gardenTerrace = await prisma.venue.create({
    data: {
      name: "Garden Terrace",
      description: "A beautiful open-air venue surrounded by lush greenery and fairy lights. Ideal for intimate gatherings, engagement ceremonies, and evening celebrations.",
      capacity: 200,
      pricePerSlot: 150000,
      amenities: ["Open Air", "Garden", "Parking", "WiFi", "Gazebo", "Water Feature"],
      isActive: true,
    },
  });

  const crystalBanquetHall = await prisma.venue.create({
    data: {
      name: "Crystal Banquet Hall",
      description:
        "A dazzling indoor venue adorned with crystal chandeliers and floor-to-ceiling mirrors. Features a dedicated dance floor and premium bar setup, perfect for grand receptions and gala dinners.",
      capacity: 350,
      pricePerSlot: 200000,
      amenities: ["AC", "Stage", "Dance Floor", "Bar Setup", "Valet Parking", "Green Room", "WiFi"],
      isActive: true,
    },
  });

  const rooftopSkyLounge = await prisma.venue.create({
    data: {
      name: "Rooftop Sky Lounge",
      description:
        "A chic rooftop venue offering breathtaking city skyline views. Modern lounge seating, ambient lighting, and an open-air atmosphere make it ideal for cocktail parties, engagement celebrations, and evening socials.",
      capacity: 150,
      pricePerSlot: 180000,
      amenities: ["Open Air", "City View", "Bar Setup", "Lounge Seating", "DJ Setup", "WiFi", "Elevator Access"],
      isActive: true,
    },
  });

  const riversidePavilion = await prisma.venue.create({
    data: {
      name: "Riverside Pavilion",
      description:
        "A scenic waterfront venue nestled along the riverbank with a charming gazebo and landscaped pathways. The natural ambiance and bonfire pit create an unforgettable setting for outdoor weddings and celebrations.",
      capacity: 250,
      pricePerSlot: 220000,
      amenities: ["Open Air", "Riverfront", "Parking", "Gazebo", "Bonfire Pit", "Garden", "Lighting Setup"],
      isActive: true,
    },
  });

  const heritageCourtyard = await prisma.venue.create({
    data: {
      name: "Heritage Courtyard",
      description:
        "A majestic venue set within restored heritage architecture featuring traditional arches, ornate pillars, and a spacious central courtyard. Ideal for traditional weddings, cultural celebrations, and royal-themed events.",
      capacity: 300,
      pricePerSlot: 230000,
      amenities: ["Heritage Architecture", "Courtyard", "Stage", "AC", "Parking", "Bridal Suite", "WiFi"],
      isActive: true,
    },
  });

  const ivoryRoom = await prisma.venue.create({
    data: {
      name: "The Ivory Room",
      description:
        "An exclusive boutique venue designed for intimate gatherings. Plush lounge seating, a private bar, and warm ambient lighting create a sophisticated setting for birthday milestones, baby showers, and private dinners.",
      capacity: 80,
      pricePerSlot: 90000,
      amenities: ["AC", "Lounge Seating", "Private Bar", "Sound System", "WiFi", "Private Entrance"],
      isActive: true,
    },
  });

  const royalConventionCentre = await prisma.venue.create({
    data: {
      name: "Royal Convention Centre",
      description:
        "The largest venue in our portfolio, featuring a massive hall with modular partitions, state-of-the-art AV systems, and multiple breakout rooms. Perfect for large-scale corporate conferences, exhibitions, and mega weddings.",
      capacity: 800,
      pricePerSlot: 400000,
      amenities: ["AC", "Stage", "Projection Screen", "Breakout Rooms", "Parking", "Catering Kitchen", "WiFi", "Sound System"],
      isActive: true,
    },
  });

  const lakeviewLawn = await prisma.venue.create({
    data: {
      name: "Lakeview Lawn",
      description:
        "A sprawling lakeside lawn venue offering panoramic water views and a dedicated mandap area. The expansive grounds, professional lighting setup, and serene surroundings make it a top choice for destination-style weddings.",
      capacity: 400,
      pricePerSlot: 280000,
      amenities: ["Open Air", "Lake View", "Mandap Area", "Parking", "Lighting Setup", "Garden", "Catering Space"],
      isActive: true,
    },
  });

  const amberSuite = await prisma.venue.create({
    data: {
      name: "The Amber Suite",
      description:
        "An elegant mid-sized venue with warm amber-toned interiors, a polished dance floor, and premium sound system. Well-suited for anniversary celebrations, engagement parties, and corporate cocktail evenings.",
      capacity: 120,
      pricePerSlot: 120000,
      amenities: ["AC", "Dance Floor", "Sound System", "WiFi", "Private Entrance", "Bar Setup"],
      isActive: true,
    },
  });

  const palmGardenResort = await prisma.venue.create({
    data: {
      name: "Palm Garden Resort",
      description:
        "A sprawling resort-style venue with lush palm gardens, a poolside event area, and multiple stage setups. On-site accommodation for guests makes it ideal for multi-day celebrations, destination weddings, and grand receptions.",
      capacity: 600,
      pricePerSlot: 350000,
      amenities: ["Open Air", "Pool Area", "Garden", "Multiple Stages", "Parking", "Accommodation", "Catering Kitchen", "WiFi"],
      isActive: true,
    },
  });

  const orchidMeetingHall = await prisma.venue.create({
    data: {
      name: "Orchid Meeting Hall",
      description:
        "A compact, professionally equipped meeting space designed for corporate workshops, board meetings, and small-scale business events. Features a conference table setup with built-in AV and complimentary refreshments.",
      capacity: 50,
      pricePerSlot: 60000,
      amenities: ["AC", "Projector", "Whiteboard", "WiFi", "Conference Table", "Tea/Coffee Service"],
      isActive: false,
    },
  });

  const venues = [
    grandBallroom,
    gardenTerrace,
    crystalBanquetHall,
    rooftopSkyLounge,
    riversidePavilion,
    heritageCourtyard,
    ivoryRoom,
    royalConventionCentre,
    lakeviewLawn,
    amberSuite,
    palmGardenResort,
    orchidMeetingHall,
  ];
  console.log(`Created ${venues.length} venues.\n`);

  // ============================================================
  // 5. Create Contacts
  // ============================================================
  console.log("Creating contacts...");

  const contactsData = [
    { firstName: "Arun", lastName: "Sharma", email: "arun.sharma@email.com", phone: generatePhone(), company: "Sharma Industries", designation: "CEO", type: "CORPORATE" as const, city: "Mumbai", state: "Maharashtra" },
    { firstName: "Deepika", lastName: "Patel", email: "deepika.p@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Ahmedabad", state: "Gujarat" },
    { firstName: "Karthik", lastName: "Reddy", email: "karthik.r@techcorp.in", phone: generatePhone(), company: "TechCorp India", designation: "VP Events", type: "CORPORATE" as const, city: "Hyderabad", state: "Telangana" },
    { firstName: "Meera", lastName: "Nair", email: "meera.nair@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Bangalore", state: "Karnataka" },
    { firstName: "Rahul", lastName: "Verma", email: "rahul.verma@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Delhi", state: "Delhi" },
    { firstName: "Sunita", lastName: "Joshi", email: "sunita.j@startupx.com", phone: generatePhone(), company: "StartupX", designation: "Founder", type: "CORPORATE" as const, city: "Pune", state: "Maharashtra" },
    { firstName: "Vikash", lastName: "Agarwal", email: "vikash.a@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Jaipur", state: "Rajasthan" },
    { firstName: "Anjali", lastName: "Singh", email: "anjali.singh@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Lucknow", state: "Uttar Pradesh" },
    { firstName: "Manoj", lastName: "Tiwari", email: "manoj.t@globalfirm.com", phone: generatePhone(), company: "Global Firm LLP", designation: "Partner", type: "CORPORATE" as const, city: "Chennai", state: "Tamil Nadu" },
    { firstName: "Pooja", lastName: "Mehta", email: "pooja.mehta@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Mumbai", state: "Maharashtra" },
    { firstName: "Sanjay", lastName: "Kapoor", email: "sanjay.k@email.com", phone: generatePhone(), company: "Kapoor Enterprises", designation: "Managing Director", type: "CORPORATE" as const, city: "Delhi", state: "Delhi" },
    { firstName: "Lakshmi", lastName: "Iyer", email: "lakshmi.iyer@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Coimbatore", state: "Tamil Nadu" },
    { firstName: "Naveen", lastName: "Prasad", email: "naveen.p@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Bangalore", state: "Karnataka" },
    { firstName: "Ritu", lastName: "Chopra", email: "ritu.chopra@mediaco.in", phone: generatePhone(), company: "MediaCo", designation: "Events Head", type: "CORPORATE" as const, city: "Gurgaon", state: "Haryana" },
    { firstName: "Gaurav", lastName: "Bansal", email: "gaurav.b@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Chandigarh", state: "Chandigarh" },
    { firstName: "Divya", lastName: "Rao", email: "divya.rao@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Hyderabad", state: "Telangana" },
    { firstName: "Ashok", lastName: "Malhotra", email: "ashok.m@email.com", phone: generatePhone(), company: "Malhotra Group", designation: "Chairman", type: "CORPORATE" as const, city: "Mumbai", state: "Maharashtra" },
    { firstName: "Nisha", lastName: "Bhatia", email: "nisha.b@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Pune", state: "Maharashtra" },
    { firstName: "Rajat", lastName: "Saxena", email: "rajat.s@consulting.in", phone: generatePhone(), company: "Saxena Consulting", designation: "Director", type: "CORPORATE" as const, city: "Noida", state: "Uttar Pradesh" },
    { firstName: "Swati", lastName: "Kulkarni", email: "swati.k@email.com", phone: generatePhone(), type: "INDIVIDUAL" as const, city: "Nagpur", state: "Maharashtra" },
  ];

  const contacts = await prisma.$transaction(
    contactsData.map((c) =>
      prisma.contact.create({
        data: {
          ...c,
          address: `${randomInt(1, 999)}, ${randomElement(["MG Road", "Park Street", "Gandhi Nagar", "Jubilee Hills", "Anna Nagar", "Banjara Hills", "Koramangala", "Andheri West"])}`,
          pincode: String(randomInt(100000, 999999)),
          tags: c.type === "CORPORATE" ? ["corporate", "vip"] : ["individual"],
        },
      })
    )
  );

  console.log(`Created ${contacts.length} contacts.\n`);

  // ============================================================
  // 6. Create Leads
  // ============================================================
  console.log("Creating leads...");

  const eventTypes = ["Wedding", "Reception", "Corporate Event", "Birthday Party", "Anniversary", "Engagement", "Baby Shower", "Social Gathering"];
  const leadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"] as const;
  const leadSources = ["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "PHONE_INQUIRY", "EMAIL", "EVENT", "PARTNER", "ADVERTISEMENT"] as const;

  const leadsData = [
    { title: "Sharma-Patel Wedding", status: "WON", source: "REFERRAL", eventType: "Wedding", value: 1500000, guestCount: 400, contactIdx: 0 },
    { title: "TechCorp Annual Gala", status: "CONFIRMED" as never, source: "WEBSITE", eventType: "Corporate Event", value: 800000, guestCount: 300, contactIdx: 2 },
    { title: "Meera's Engagement", status: "PROPOSAL_SENT", source: "SOCIAL_MEDIA", eventType: "Engagement", value: 500000, guestCount: 150, contactIdx: 3 },
    { title: "Verma Reception", status: "NEGOTIATION", source: "WALK_IN", eventType: "Reception", value: 1200000, guestCount: 350, contactIdx: 4 },
    { title: "StartupX Product Launch", status: "WON", source: "EMAIL", eventType: "Corporate Event", value: 600000, guestCount: 200, contactIdx: 5 },
    { title: "Agarwal Anniversary", status: "NEW", source: "PHONE_INQUIRY", eventType: "Anniversary", value: 400000, guestCount: 100, contactIdx: 6 },
    { title: "Singh Baby Shower", status: "CONTACTED", source: "REFERRAL", eventType: "Baby Shower", value: 200000, guestCount: 80, contactIdx: 7 },
    { title: "Global Firm Conference", status: "QUALIFIED", source: "PARTNER", eventType: "Corporate Event", value: 2000000, guestCount: 450, contactIdx: 8 },
    { title: "Mehta Birthday Bash", status: "WON", source: "SOCIAL_MEDIA", eventType: "Birthday Party", value: 350000, guestCount: 120, contactIdx: 9 },
    { title: "Kapoor Wedding", status: "NEGOTIATION", source: "ADVERTISEMENT", eventType: "Wedding", value: 2500000, guestCount: 500, contactIdx: 10 },
    { title: "Iyer Engagement", status: "NEW", source: "WEBSITE", eventType: "Engagement", value: 450000, guestCount: 130, contactIdx: 11 },
    { title: "Prasad Housewarming", status: "LOST", source: "WALK_IN", eventType: "Social Gathering", value: 300000, guestCount: 100, contactIdx: 12 },
    { title: "MediaCo Awards Night", status: "PROPOSAL_SENT", source: "PARTNER", eventType: "Corporate Event", value: 1800000, guestCount: 400, contactIdx: 13 },
    { title: "Bansal Reception", status: "CONTACTED", source: "REFERRAL", eventType: "Reception", value: 700000, guestCount: 250, contactIdx: 14 },
    { title: "Rao Wedding Celebration", status: "QUALIFIED", source: "SOCIAL_MEDIA", eventType: "Wedding", value: 1600000, guestCount: 380, contactIdx: 15 },
  ];

  const leads = await prisma.$transaction(
    leadsData.map((l, idx) => {
      const adjustedStatus = l.status === ("CONFIRMED" as never) ? "QUALIFIED" : l.status;
      return prisma.lead.create({
        data: {
          title: l.title,
          description: `Inquiry for ${l.eventType.toLowerCase()} event at Veloria Grand.`,
          status: adjustedStatus as any,
          source: l.source as any,
          score: randomInt(20, 95),
          estimatedValue: l.value,
          eventDate: addDays(now, randomInt(15, 120)),
          eventType: l.eventType,
          guestCount: l.guestCount,
          followUpDate: adjustedStatus === "NEW" || adjustedStatus === "CONTACTED"
            ? addDays(now, randomInt(1, 7))
            : null,
          lostReason: adjustedStatus === "LOST" ? "Budget constraints" : null,
          contactId: contacts[l.contactIdx].id,
          assignedToId: randomElement(salesExecs).id,
          createdById: randomElement(salesExecs).id,
          createdAt: subDays(now, randomInt(5, 60)),
        },
      });
    })
  );

  console.log(`Created ${leads.length} leads.\n`);

  // ============================================================
  // 7. Create Deals
  // ============================================================
  console.log("Creating deals...");

  const dealLeadMap = [
    { leadIdx: 0, stageIdx: 4, probability: 100, wonDate: subDays(now, 20) },  // Won
    { leadIdx: 1, stageIdx: 2, probability: 60, wonDate: null },                // Proposal Sent
    { leadIdx: 2, stageIdx: 2, probability: 55, wonDate: null },                // Proposal Sent
    { leadIdx: 3, stageIdx: 3, probability: 70, wonDate: null },                // Negotiation
    { leadIdx: 4, stageIdx: 4, probability: 100, wonDate: subDays(now, 10) },  // Won
    { leadIdx: 7, stageIdx: 1, probability: 40, wonDate: null },                // Site Visit
    { leadIdx: 8, stageIdx: 4, probability: 100, wonDate: subDays(now, 5) },   // Won
    { leadIdx: 9, stageIdx: 3, probability: 65, wonDate: null },                // Negotiation
    { leadIdx: 11, stageIdx: 5, probability: 0, wonDate: null },               // Lost
    { leadIdx: 12, stageIdx: 2, probability: 50, wonDate: null },               // Proposal Sent
  ];

  const deals = await prisma.$transaction(
    dealLeadMap.map((d, idx) =>
      prisma.deal.create({
        data: {
          title: leads[d.leadIdx].title,
          value: leadsData[d.leadIdx].value,
          probability: d.probability,
          expectedCloseDate: addDays(now, randomInt(10, 60)),
          notes: `Deal for ${leads[d.leadIdx].title}`,
          wonDate: d.wonDate,
          lostDate: d.stageIdx === 5 ? subDays(now, 15) : null,
          lostReason: d.stageIdx === 5 ? "Budget constraints" : null,
          orderInStage: idx,
          stageId: stages[d.stageIdx].id,
          leadId: leads[d.leadIdx].id,
          assignedToId: randomElement(salesExecs).id,
        },
      })
    )
  );

  console.log(`Created ${deals.length} deals.\n`);

  // ============================================================
  // 8. Create Bookings
  // ============================================================
  console.log("Creating bookings...");

  const bookingsData = [
    {
      bookingNumber: "VG-2026-001",
      eventName: "Sharma-Patel Wedding Reception",
      eventType: "Wedding",
      status: "CONFIRMED" as const,
      date: addDays(now, 5),
      timeSlot: "EVENING" as const,
      guestCount: 400,
      totalAmount: 1500000,
      venueIdx: 0,
      contactIdx: 0,
      dealIdx: 0,
    },
    {
      bookingNumber: "VG-2026-002",
      eventName: "StartupX Product Launch",
      eventType: "Corporate Event",
      status: "CONFIRMED" as const,
      date: addDays(now, 12),
      timeSlot: "MORNING" as const,
      guestCount: 200,
      totalAmount: 600000,
      venueIdx: 1,
      contactIdx: 5,
      dealIdx: 4,
    },
    {
      bookingNumber: "VG-2026-003",
      eventName: "Mehta Birthday Celebration",
      eventType: "Birthday Party",
      status: "IN_PROGRESS" as const,
      date: addDays(now, 1),
      timeSlot: "EVENING" as const,
      guestCount: 120,
      totalAmount: 350000,
      venueIdx: 1,
      contactIdx: 9,
      dealIdx: 6,
    },
    {
      bookingNumber: "VG-2026-004",
      eventName: "Kapoor Grand Wedding",
      eventType: "Wedding",
      status: "HOLD" as const,
      date: addDays(now, 30),
      timeSlot: "FULL_DAY" as const,
      guestCount: 500,
      totalAmount: 2500000,
      venueIdx: 0,
      contactIdx: 10,
      dealIdx: null,
    },
    {
      bookingNumber: "VG-2026-005",
      eventName: "Global Firm Annual Conference",
      eventType: "Corporate Event",
      status: "TENTATIVE" as const,
      date: addDays(now, 45),
      timeSlot: "FULL_DAY" as const,
      guestCount: 450,
      totalAmount: 2000000,
      venueIdx: 0,
      contactIdx: 8,
      dealIdx: null,
    },
    {
      bookingNumber: "VG-2026-006",
      eventName: "Verma Engagement Ceremony",
      eventType: "Engagement",
      status: "CONFIRMED" as const,
      date: addDays(now, 3),
      timeSlot: "EVENING" as const,
      guestCount: 150,
      totalAmount: 500000,
      venueIdx: 1,
      contactIdx: 4,
      dealIdx: null,
    },
    {
      bookingNumber: "VG-2026-007",
      eventName: "Desai Anniversary Dinner",
      eventType: "Anniversary",
      status: "COMPLETED" as const,
      date: subDays(now, 5),
      timeSlot: "EVENING" as const,
      guestCount: 100,
      totalAmount: 400000,
      venueIdx: 1,
      contactIdx: 15,
      dealIdx: null,
    },
    {
      bookingNumber: "VG-2026-008",
      eventName: "MediaCo Awards Night",
      eventType: "Corporate Event",
      status: "CONFIRMED" as const,
      date: addDays(now, 20),
      timeSlot: "EVENING" as const,
      guestCount: 350,
      totalAmount: 1800000,
      venueIdx: 0,
      contactIdx: 13,
      dealIdx: null,
    },
  ];

  const bookings = await prisma.$transaction(
    bookingsData.map((b) =>
      prisma.booking.create({
        data: {
          bookingNumber: b.bookingNumber,
          eventName: b.eventName,
          eventType: b.eventType,
          status: b.status,
          date: b.date,
          timeSlot: b.timeSlot,
          guestCount: b.guestCount,
          totalAmount: b.totalAmount,
          specialRequests: randomElement([
            "Veg and non-veg buffet required",
            "Special lighting arrangements needed",
            "Live band performance space",
            "Need extra parking for 50+ cars",
            null,
          ]),
          venueId: venues[b.venueIdx].id,
          contactId: contacts[b.contactIdx].id,
          dealId: b.dealIdx !== null ? deals[b.dealIdx].id : null,
          createdById: randomElement(internalUsers).id,
        },
      })
    )
  );

  console.log(`Created ${bookings.length} bookings.\n`);

  // ============================================================
  // 9. Create Task Templates
  // ============================================================
  console.log("Creating task templates...");

  const taskTemplates = await prisma.$transaction([
    prisma.taskTemplate.create({
      data: {
        name: "Wedding Setup Checklist",
        description: "Standard checklist for wedding event setup",
        items: JSON.parse(JSON.stringify([
          "Confirm venue decoration theme",
          "Arrange flowers and centerpieces",
          "Set up stage and mandap",
          "Test sound system and DJ setup",
          "Coordinate with caterer for menu",
          "Arrange valet parking",
          "Prepare bridal suite",
          "Final walkthrough with couple",
        ])),
      },
    }),
    prisma.taskTemplate.create({
      data: {
        name: "Corporate Event Checklist",
        description: "Standard checklist for corporate events",
        items: JSON.parse(JSON.stringify([
          "Set up AV equipment",
          "Arrange seating as per layout",
          "Test microphones and projectors",
          "Coordinate with IT for WiFi",
          "Set up registration desk",
          "Prepare name badges",
          "Arrange coffee/tea stations",
        ])),
      },
    }),
    prisma.taskTemplate.create({
      data: {
        name: "Payment Follow-up",
        description: "Payment collection checklist",
        items: JSON.parse(JSON.stringify([
          "Send invoice to client",
          "Follow up on advance payment",
          "Confirm payment received",
          "Issue receipt",
        ])),
      },
    }),
    prisma.taskTemplate.create({
      data: {
        name: "Post-Event Cleanup",
        description: "Checklist for after the event",
        items: JSON.parse(JSON.stringify([
          "Collect feedback from client",
          "Inventory check of equipment",
          "Venue cleanup and inspection",
          "Process final payment",
          "Send thank you note",
        ])),
      },
    }),
    prisma.taskTemplate.create({
      data: {
        name: "Vendor Coordination",
        description: "Vendor management checklist",
        items: JSON.parse(JSON.stringify([
          "Confirm catering order",
          "Confirm decorator booking",
          "Confirm photographer",
          "Confirm entertainment/DJ",
          "Collect vendor invoices",
        ])),
      },
    }),
  ]);

  console.log(`Created ${taskTemplates.length} task templates.\n`);

  // ============================================================
  // 10. Create Tasks
  // ============================================================
  console.log("Creating tasks...");

  const taskStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
  const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

  const tasksData = [
    { title: "Confirm venue decoration for Sharma Wedding", bookingIdx: 0, status: "IN_PROGRESS", priority: "HIGH", dueDate: addDays(now, 3) },
    { title: "Arrange flowers for Sharma Wedding", bookingIdx: 0, status: "TODO", priority: "MEDIUM", dueDate: addDays(now, 4) },
    { title: "Test AV equipment for StartupX Launch", bookingIdx: 1, status: "TODO", priority: "HIGH", dueDate: addDays(now, 10) },
    { title: "Coordinate catering for Mehta Birthday", bookingIdx: 2, status: "DONE", priority: "URGENT", dueDate: subDays(now, 1) },
    { title: "Send contract to Kapoor family", bookingIdx: 3, status: "TODO", priority: "HIGH", dueDate: addDays(now, 2) },
    { title: "Prepare seating layout for Global Firm", bookingIdx: 4, status: "IN_REVIEW", priority: "MEDIUM", dueDate: addDays(now, 30) },
    { title: "Follow up on advance payment - Verma", bookingIdx: 5, status: "IN_PROGRESS", priority: "URGENT", dueDate: subDays(now, 2) },
    { title: "Collect feedback from Desai Anniversary", bookingIdx: 6, status: "TODO", priority: "LOW", dueDate: addDays(now, 1) },
    { title: "Confirm photographer for MediaCo Awards", bookingIdx: 7, status: "TODO", priority: "MEDIUM", dueDate: addDays(now, 15) },
    { title: "Arrange valet parking for Sharma Wedding", bookingIdx: 0, status: "TODO", priority: "MEDIUM", dueDate: addDays(now, 4) },
    { title: "Setup registration desk - StartupX", bookingIdx: 1, status: "TODO", priority: "LOW", dueDate: addDays(now, 11) },
    { title: "Prepare bridal suite - Sharma Wedding", bookingIdx: 0, status: "TODO", priority: "HIGH", dueDate: addDays(now, 4) },
    { title: "Order special lighting for MediaCo", bookingIdx: 7, status: "IN_PROGRESS", priority: "HIGH", dueDate: addDays(now, 12) },
    { title: "Confirm live band for Mehta Birthday", bookingIdx: 2, status: "DONE", priority: "HIGH", dueDate: subDays(now, 2) },
    { title: "Process final payment - Desai Anniversary", bookingIdx: 6, status: "TODO", priority: "MEDIUM", dueDate: subDays(now, 3) },
    { title: "Send thank you note to Desai family", bookingIdx: 6, status: "TODO", priority: "LOW", dueDate: subDays(now, 1) },
    { title: "Coordinate with DJ for Sharma Wedding", bookingIdx: 0, status: "IN_PROGRESS", priority: "MEDIUM", dueDate: addDays(now, 3) },
    { title: "Verify guest list for Verma Engagement", bookingIdx: 5, status: "IN_REVIEW", priority: "HIGH", dueDate: addDays(now, 1) },
    { title: "Arrange backup generator for Global Firm", bookingIdx: 4, status: "TODO", priority: "MEDIUM", dueDate: addDays(now, 40) },
    { title: "Final walkthrough - Mehta Birthday", bookingIdx: 2, status: "DONE", priority: "URGENT", dueDate: subDays(now, 1) },
  ];

  const tasks: Awaited<ReturnType<typeof prisma.task.create>>[] = [];
  for (const t of tasksData) {
    const task = await prisma.task.create({
      data: {
        title: t.title,
        description: `Task for ${bookingsData[t.bookingIdx].eventName}`,
        status: t.status as any,
        priority: t.priority as any,
        dueDate: t.dueDate,
        completedAt: t.status === "DONE" ? subDays(now, 1) : null,
        assigneeId: randomElement(internalUsers).id,
        creatorId: randomElement([admin, eventCoordinator]).id,
        bookingId: bookings[t.bookingIdx].id,
      },
    });
    tasks.push(task);
  }

  // Add checklist items to some tasks
  const checklistData = [
    { taskIdx: 0, items: ["Choose color scheme", "Confirm with decorator", "Approve final design"] },
    { taskIdx: 2, items: ["Test projector", "Test microphones", "Test screen sharing", "Test recording setup"] },
    { taskIdx: 4, items: ["Draft contract", "Legal review", "Send to client", "Follow up for signature"] },
    { taskIdx: 6, items: ["Send payment reminder", "Follow up call", "Confirm receipt"] },
    { taskIdx: 12, items: ["Select lighting fixtures", "Test lighting setup", "Get client approval"] },
  ];

  for (const cl of checklistData) {
    await prisma.$transaction(
      cl.items.map((item, idx) =>
        prisma.checklistItem.create({
          data: {
            title: item,
            isCompleted: idx === 0, // first item completed
            completedAt: idx === 0 ? subDays(now, 1) : null,
            order: idx,
            taskId: tasks[cl.taskIdx].id,
          },
        })
      )
    );
  }

  console.log(`Created ${tasks.length} tasks with checklist items.\n`);

  // ============================================================
  // 11. Create Invoices with Line Items
  // ============================================================
  console.log("Creating invoices...");

  const invoicesData = [
    {
      invoiceNumber: "VG-INV-2026-001",
      status: "PARTIALLY_PAID" as const,
      bookingIdx: 0,
      contactIdx: 0,
      subtotal: 1500000,
      paidAmount: 750000,
      dueDate: addDays(now, 15),
      lineItems: [
        { description: "Grand Ballroom - Evening Slot", quantity: 1, unitPrice: 250000 },
        { description: "Premium Decoration Package", quantity: 1, unitPrice: 500000 },
        { description: "Catering (400 guests)", quantity: 400, unitPrice: 1500 },
        { description: "DJ & Sound Setup", quantity: 1, unitPrice: 100000 },
        { description: "Valet Parking Service", quantity: 1, unitPrice: 50000 },
      ],
    },
    {
      invoiceNumber: "VG-INV-2026-002",
      status: "SENT" as const,
      bookingIdx: 1,
      contactIdx: 5,
      subtotal: 600000,
      paidAmount: 0,
      dueDate: addDays(now, 10),
      lineItems: [
        { description: "Garden Terrace - Morning Slot", quantity: 1, unitPrice: 150000 },
        { description: "AV Equipment & Setup", quantity: 1, unitPrice: 200000 },
        { description: "Catering (200 guests)", quantity: 200, unitPrice: 1000 },
        { description: "Registration Desk Setup", quantity: 1, unitPrice: 50000 },
      ],
    },
    {
      invoiceNumber: "VG-INV-2026-003",
      status: "PAID" as const,
      bookingIdx: 2,
      contactIdx: 9,
      subtotal: 350000,
      paidAmount: 350000,
      dueDate: subDays(now, 5),
      lineItems: [
        { description: "Garden Terrace - Evening Slot", quantity: 1, unitPrice: 150000 },
        { description: "Birthday Theme Decoration", quantity: 1, unitPrice: 100000 },
        { description: "Catering (120 guests)", quantity: 120, unitPrice: 800 },
        { description: "Live Band", quantity: 1, unitPrice: 4000 },
      ],
    },
    {
      invoiceNumber: "VG-INV-2026-004",
      status: "OVERDUE" as const,
      bookingIdx: 6,
      contactIdx: 15,
      subtotal: 400000,
      paidAmount: 200000,
      dueDate: subDays(now, 10),
      lineItems: [
        { description: "Garden Terrace - Evening Slot", quantity: 1, unitPrice: 150000 },
        { description: "Anniversary Decoration", quantity: 1, unitPrice: 120000 },
        { description: "Catering (100 guests)", quantity: 100, unitPrice: 1000 },
        { description: "Photography Package", quantity: 1, unitPrice: 30000 },
      ],
    },
    {
      invoiceNumber: "VG-INV-2026-005",
      status: "DRAFT" as const,
      bookingIdx: 7,
      contactIdx: 13,
      subtotal: 1800000,
      paidAmount: 0,
      dueDate: addDays(now, 30),
      lineItems: [
        { description: "Grand Ballroom - Evening Slot", quantity: 1, unitPrice: 250000 },
        { description: "Awards Night Stage Setup", quantity: 1, unitPrice: 500000 },
        { description: "Premium Catering (350 guests)", quantity: 350, unitPrice: 2000 },
        { description: "AV & Lighting Package", quantity: 1, unitPrice: 300000 },
        { description: "Red Carpet & Backdrop", quantity: 1, unitPrice: 50000 },
      ],
    },
  ];

  const invoices = [];
  for (const inv of invoicesData) {
    const cgstAmount = Math.round(inv.subtotal * 0.09);
    const sgstAmount = Math.round(inv.subtotal * 0.09);
    const totalAmount = inv.subtotal + cgstAmount + sgstAmount;
    const balanceDue = totalAmount - inv.paidAmount;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        issueDate: subDays(inv.dueDate, 30),
        dueDate: inv.dueDate,
        subtotal: inv.subtotal,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        cgstAmount,
        sgstAmount,
        igstAmount: 0,
        totalAmount,
        paidAmount: inv.paidAmount,
        balanceDue,
        contactId: contacts[inv.contactIdx].id,
        bookingId: bookings[inv.bookingIdx].id,
        createdById: finance.id,
        gstin: inv.contactIdx % 3 === 0 ? `27AAAC${randomInt(1000000, 9999999)}1Z${randomInt(1, 9)}` : null,
        placeOfSupply: "Maharashtra",
        sacCode: "996332",
        notes: "Payment terms: 50% advance, 50% before event date.",
        terms: "All payments are subject to GST as applicable. Cancellation charges apply as per agreement.",
      },
    });

    // Create line items
    await prisma.$transaction(
      inv.lineItems.map((li, idx) =>
        prisma.invoiceLineItem.create({
          data: {
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            amount: li.quantity * li.unitPrice,
            order: idx,
            invoiceId: invoice.id,
          },
        })
      )
    );

    invoices.push(invoice);
  }

  console.log(`Created ${invoices.length} invoices with line items.\n`);

  // ============================================================
  // 12. Create Payments
  // ============================================================
  console.log("Creating payments...");

  const paymentsData = [
    {
      amount: 750000,
      status: "COMPLETED" as const,
      method: "BANK_TRANSFER" as const,
      invoiceIdx: 0,
      paidAt: subDays(now, 15),
      transactionId: `TXN${randomInt(100000, 999999)}`,
      receiptNumber: "VG-REC-001",
    },
    {
      amount: 350000,
      status: "COMPLETED" as const,
      method: "UPI" as const,
      invoiceIdx: 2,
      paidAt: subDays(now, 7),
      transactionId: `TXN${randomInt(100000, 999999)}`,
      receiptNumber: "VG-REC-002",
    },
    {
      amount: 200000,
      status: "COMPLETED" as const,
      method: "RAZORPAY" as const,
      invoiceIdx: 3,
      paidAt: subDays(now, 20),
      transactionId: `pay_${String.fromCharCode(...Array.from({ length: 14 }, () => randomInt(97, 122)))}`,
      receiptNumber: "VG-REC-003",
    },
  ];

  const payments = [];
  for (const p of paymentsData) {
    const payment = await prisma.payment.create({
      data: {
        amount: p.amount,
        status: p.status,
        method: p.method,
        transactionId: p.transactionId,
        receiptNumber: p.receiptNumber,
        paidAt: p.paidAt,
        invoiceId: invoices[p.invoiceIdx].id,
        notes: `Payment received via ${p.method.toLowerCase().replace("_", " ")}`,
      },
    });
    payments.push(payment);
  }

  console.log(`Created ${payments.length} payments.\n`);

  // ============================================================
  // 13. Create Notifications
  // ============================================================
  console.log("Creating notifications...");

  const notificationsData = [
    { userId: admin.id, type: "BOOKING_CREATED" as const, title: "New Booking Created", message: "Sharma-Patel Wedding Reception has been booked for the Grand Ballroom.", actionUrl: "/bookings", isRead: false },
    { userId: admin.id, type: "PAYMENT_RECEIVED" as const, title: "Payment Received", message: "Payment of \u20B97,50,000 received for invoice VG-INV-2026-001 via bank transfer.", actionUrl: "/invoices", isRead: false },
    { userId: salesExec1.id, type: "LEAD_ASSIGNED" as const, title: "New Lead Assigned", message: "You have been assigned the lead 'Kapoor Wedding'. Estimated value: \u20B925,00,000.", actionUrl: "/leads", isRead: false },
    { userId: salesExec2.id, type: "DEAL_WON" as const, title: "Deal Won!", message: "Congratulations! The deal 'Mehta Birthday Bash' worth \u20B93,50,000 has been won.", actionUrl: "/pipeline", isRead: true },
    { userId: eventCoordinator.id, type: "TASK_ASSIGNED" as const, title: "Task Assigned", message: "You have been assigned the task 'Confirm venue decoration for Sharma Wedding'. Due in 3 days.", actionUrl: "/tasks", isRead: false },
    { userId: finance.id, type: "PAYMENT_OVERDUE" as const, title: "Payment Overdue", message: "Invoice VG-INV-2026-004 for Desai Anniversary is overdue. Balance: \u20B92,00,000.", actionUrl: "/invoices", isRead: false },
    { userId: admin.id, type: "BOOKING_UPDATED" as const, title: "Booking Updated", message: "Mehta Birthday Celebration status changed to In Progress.", actionUrl: "/bookings", isRead: true },
    { userId: eventCoordinator.id, type: "TASK_OVERDUE" as const, title: "Task Overdue", message: "The task 'Follow up on advance payment - Verma' is 2 days overdue.", actionUrl: "/tasks", isRead: false },
    { userId: admin.id, type: "SYSTEM" as const, title: "System Update", message: "The system has been updated with new dashboard analytics and reporting features.", isRead: true },
    { userId: salesExec1.id, type: "BOOKING_CANCELLED" as const, title: "Booking Inquiry Cancelled", message: "The inquiry from Prasad for Social Gathering has been marked as lost due to budget constraints.", isRead: true },
  ];

  const notifications = await prisma.$transaction(
    notificationsData.map((n, idx) =>
      prisma.notification.create({
        data: {
          type: n.type,
          title: n.title,
          message: n.message,
          actionUrl: n.actionUrl || null,
          isRead: n.isRead,
          userId: n.userId,
          createdAt: subDays(now, idx),
        },
      })
    )
  );

  console.log(`Created ${notifications.length} notifications.\n`);

  // ============================================================
  // 14. Create Activity Logs
  // ============================================================
  console.log("Creating activity logs...");

  const activityData = [
    { action: "created", entityType: "Booking", entityId: bookings[0].id, userId: admin.id, createdAt: subDays(now, 20) },
    { action: "created", entityType: "Booking", entityId: bookings[1].id, userId: salesExec1.id, createdAt: subDays(now, 18) },
    { action: "updated", entityType: "Booking", entityId: bookings[0].id, userId: admin.id, createdAt: subDays(now, 15), changes: { status: { from: "HOLD", to: "CONFIRMED" } } },
    { action: "created", entityType: "Invoice", entityId: invoices[0].id, userId: finance.id, createdAt: subDays(now, 15) },
    { action: "created", entityType: "Payment", entityId: payments[0].id, userId: finance.id, createdAt: subDays(now, 15) },
    { action: "created", entityType: "Lead", entityId: leads[9].id, userId: salesExec2.id, createdAt: subDays(now, 12) },
    { action: "updated", entityType: "Deal", entityId: deals[6].id, userId: salesExec1.id, createdAt: subDays(now, 5), changes: { stage: { from: "Negotiation", to: "Won" } } },
    { action: "created", entityType: "Task", entityId: tasks[0].id, userId: eventCoordinator.id, createdAt: subDays(now, 10) },
    { action: "completed", entityType: "Task", entityId: tasks[3].id, userId: staff.id, createdAt: subDays(now, 1) },
    { action: "updated", entityType: "Booking", entityId: bookings[2].id, userId: admin.id, createdAt: subDays(now, 1), changes: { status: { from: "CONFIRMED", to: "IN_PROGRESS" } } },
    { action: "created", entityType: "Contact", entityId: contacts[0].id, userId: salesExec1.id, createdAt: subDays(now, 60) },
    { action: "created", entityType: "Invoice", entityId: invoices[2].id, userId: finance.id, createdAt: subDays(now, 10) },
    { action: "sent", entityType: "Invoice", entityId: invoices[1].id, userId: finance.id, createdAt: subDays(now, 8) },
    { action: "created", entityType: "Booking", entityId: bookings[5].id, userId: salesExec2.id, createdAt: subDays(now, 7) },
    { action: "updated", entityType: "Lead", entityId: leads[3].id, userId: salesExec1.id, createdAt: subDays(now, 3), changes: { status: { from: "QUALIFIED", to: "NEGOTIATION" } } },
  ];

  await prisma.$transaction(
    activityData.map((a) =>
      prisma.activityLog.create({
        data: {
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          changes: a.changes ? JSON.parse(JSON.stringify(a.changes)) : null,
          userId: a.userId,
          createdAt: a.createdAt,
        },
      })
    )
  );

  console.log(`Created ${activityData.length} activity logs.\n`);

  // ============================================================
  // 12. Create Escalation Rules (30 business-specific rules)
  // ============================================================
  console.log("Creating escalation rules...");

  const escalationRules = await prisma.escalationRule.createManyAndReturn({
    data: [
      // ── CATERING (most time-sensitive during events) ──────────
      {
        name: "Catering Urgent — Supervisor Alert",
        category: "CATERING",
        priority: "URGENT",
        delayThresholdMinutes: 5,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Catering Urgent — Manager Escalation",
        category: "CATERING",
        priority: "URGENT",
        delayThresholdMinutes: 15,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },
      {
        name: "Catering Urgent — Leadership Crisis",
        category: "CATERING",
        priority: "URGENT",
        delayThresholdMinutes: 30,
        level: "L3_LEADERSHIP",
        notifyRoles: ["SUPER_ADMIN"],
      },
      {
        name: "Catering High — Supervisor Alert",
        category: "CATERING",
        priority: "HIGH",
        delayThresholdMinutes: 15,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Catering High — Manager Escalation",
        category: "CATERING",
        priority: "HIGH",
        delayThresholdMinutes: 30,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },

      // ── SECURITY (safety-critical, tight thresholds) ─────────
      {
        name: "Security Urgent — Immediate Supervisor",
        category: "SECURITY",
        priority: "URGENT",
        delayThresholdMinutes: 5,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR", "ADMIN"],
      },
      {
        name: "Security Urgent — Manager Emergency",
        category: "SECURITY",
        priority: "URGENT",
        delayThresholdMinutes: 10,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },
      {
        name: "Security Urgent — Leadership Emergency",
        category: "SECURITY",
        priority: "URGENT",
        delayThresholdMinutes: 20,
        level: "L3_LEADERSHIP",
        notifyRoles: ["SUPER_ADMIN"],
      },
      {
        name: "Security High — Supervisor Alert",
        category: "SECURITY",
        priority: "HIGH",
        delayThresholdMinutes: 10,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Security High — Manager Escalation",
        category: "SECURITY",
        priority: "HIGH",
        delayThresholdMinutes: 20,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },

      // ── AV (Audio/Visual — critical during live events) ──────
      {
        name: "AV Urgent — Supervisor Alert",
        category: "AV",
        priority: "URGENT",
        delayThresholdMinutes: 5,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "AV Urgent — Manager Escalation",
        category: "AV",
        priority: "URGENT",
        delayThresholdMinutes: 15,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },
      {
        name: "AV High — Supervisor Alert",
        category: "AV",
        priority: "HIGH",
        delayThresholdMinutes: 15,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "AV High — Manager Escalation",
        category: "AV",
        priority: "HIGH",
        delayThresholdMinutes: 45,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },

      // ── DECOR (setup-phase critical) ─────────────────────────
      {
        name: "Décor Urgent — Supervisor Alert",
        category: "DECOR",
        priority: "URGENT",
        delayThresholdMinutes: 10,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Décor Urgent — Manager Escalation",
        category: "DECOR",
        priority: "URGENT",
        delayThresholdMinutes: 30,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },
      {
        name: "Décor High — Supervisor Alert",
        category: "DECOR",
        priority: "HIGH",
        delayThresholdMinutes: 20,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Décor Medium — Supervisor Alert",
        category: "DECOR",
        priority: "MEDIUM",
        delayThresholdMinutes: 45,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },

      // ── ENTERTAINMENT (live event critical) ──────────────────
      {
        name: "Entertainment Urgent — Supervisor Alert",
        category: "ENTERTAINMENT",
        priority: "URGENT",
        delayThresholdMinutes: 5,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Entertainment Urgent — Manager Escalation",
        category: "ENTERTAINMENT",
        priority: "URGENT",
        delayThresholdMinutes: 15,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN", "SUPER_ADMIN"],
      },
      {
        name: "Entertainment High — Supervisor Alert",
        category: "ENTERTAINMENT",
        priority: "HIGH",
        delayThresholdMinutes: 15,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },

      // ── GUEST_SEATING (guest arrival phase critical) ─────────
      {
        name: "Guest Seating Urgent — Supervisor Alert",
        category: "GUEST_SEATING",
        priority: "URGENT",
        delayThresholdMinutes: 5,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Guest Seating High — Supervisor Alert",
        category: "GUEST_SEATING",
        priority: "HIGH",
        delayThresholdMinutes: 15,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Guest Seating High — Manager Escalation",
        category: "GUEST_SEATING",
        priority: "HIGH",
        delayThresholdMinutes: 30,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },

      // ── LOGISTICS (setup & handover phases) ──────────────────
      {
        name: "Logistics Urgent — Supervisor Alert",
        category: "LOGISTICS",
        priority: "URGENT",
        delayThresholdMinutes: 10,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Logistics High — Supervisor Alert",
        category: "LOGISTICS",
        priority: "HIGH",
        delayThresholdMinutes: 20,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
      {
        name: "Logistics High — Manager Escalation",
        category: "LOGISTICS",
        priority: "HIGH",
        delayThresholdMinutes: 60,
        level: "L2_MANAGER",
        notifyRoles: ["ADMIN"],
      },

      // ── HOUSEKEEPING (wrap-up phase) ─────────────────────────
      {
        name: "Housekeeping High — Supervisor Alert",
        category: "HOUSEKEEPING",
        priority: "HIGH",
        delayThresholdMinutes: 20,
        level: "L1_SUPERVISOR",
        notifyRoles: ["STAFF"],
      },
      {
        name: "Housekeeping Medium — Supervisor Alert",
        category: "HOUSEKEEPING",
        priority: "MEDIUM",
        delayThresholdMinutes: 45,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },

      // ── GENERAL (catch-all) ──────────────────────────────────
      {
        name: "General Urgent — Supervisor Alert",
        category: "GENERAL",
        priority: "URGENT",
        delayThresholdMinutes: 15,
        level: "L1_SUPERVISOR",
        notifyRoles: ["EVENT_COORDINATOR"],
      },
    ],
  });

  console.log(`Created ${escalationRules.length} escalation rules.\n`);

  // ============================================================
  // 15. Create Vendors
  // ============================================================
  console.log("Creating vendors...");

  const vendorsData = [
    {
      name: "Royal Caterers",
      category: "CATERING" as const,
      email: "info@royalcaterers.in",
      phone: "+91 9811234567",
      company: "Royal Caterers Pvt Ltd",
      address: "Sector 12, Noida, UP",
      rating: 5,
      totalBookings: 45,
      tags: ["premium", "multi-cuisine", "live-counters"],
    },
    {
      name: "Sparkle Décor Studio",
      category: "DECORATION" as const,
      email: "hello@sparkledecor.in",
      phone: "+91 9822345678",
      company: "Sparkle Décor Studio LLP",
      address: "MG Road, Bangalore",
      rating: 4,
      totalBookings: 32,
      tags: ["wedding", "corporate", "theme-based"],
    },
    {
      name: "Lens & Light Photography",
      category: "PHOTOGRAPHY" as const,
      email: "book@lenslight.in",
      phone: "+91 9833456789",
      company: "Lens & Light",
      address: "Bandra West, Mumbai",
      rating: 5,
      totalBookings: 58,
      tags: ["candid", "cinematic", "drone"],
    },
    {
      name: "SoundWave Productions",
      category: "SOUND" as const,
      email: "events@soundwave.in",
      phone: "+91 9844567890",
      company: "SoundWave Productions",
      address: "Koramangala, Bangalore",
      rating: 4,
      totalBookings: 28,
      tags: ["dj", "live-sound", "lighting"],
    },
    {
      name: "Flora Dreams",
      category: "FLORIST" as const,
      email: "orders@floradreams.in",
      phone: "+91 9855678901",
      company: "Flora Dreams",
      address: "Jubilee Hills, Hyderabad",
      rating: 4,
      totalBookings: 20,
      tags: ["fresh-flowers", "mandap", "car-decoration"],
    },
    {
      name: "Elite Security Services",
      category: "SECURITY" as const,
      email: "ops@elitesec.in",
      phone: "+91 9866789012",
      company: "Elite Security Services Pvt Ltd",
      address: "Connaught Place, Delhi",
      rating: 4,
      totalBookings: 35,
      tags: ["bouncers", "valet", "crowd-management"],
    },
    {
      name: "Star Entertainment Group",
      category: "ENTERTAINMENT" as const,
      email: "shows@starentertain.in",
      phone: "+91 9877890123",
      company: "Star Entertainment Group",
      address: "Film City Road, Mumbai",
      rating: 5,
      totalBookings: 40,
      tags: ["live-band", "anchor", "dance-troupe"],
    },
    {
      name: "Pristine Cleaners",
      category: "CLEANING" as const,
      email: "service@pristineclean.in",
      phone: "+91 9888901234",
      company: "Pristine Cleaning Services",
      address: "Whitefield, Bangalore",
      rating: 3,
      totalBookings: 60,
      tags: ["post-event", "deep-clean", "daily"],
    },
  ];

  const vendors = await prisma.$transaction(
    vendorsData.map((v) =>
      prisma.vendor.create({
        data: {
          name: v.name,
          category: v.category,
          status: "ACTIVE",
          email: v.email,
          phone: v.phone,
          company: v.company,
          address: v.address,
          rating: v.rating,
          totalBookings: v.totalBookings,
          tags: v.tags,
        },
      })
    )
  );

  console.log(`Created ${vendors.length} vendors.\n`);

  // ============================================================
  // 16. Create Referrals (sample referral pipeline data)
  // ============================================================
  console.log("Creating referrals...");

  const referralsData = [
    {
      referralCode: "VG-REF-001",
      referralLink: "https://veloriagrand.com/refer/VG-REF-001",
      referredName: "Ananya Khanna",
      referredEmail: "ananya.k@email.com",
      referredPhone: "+91 9901234567",
      source: "GUEST" as const,
      status: "CONVERTED" as const,
      rewardPoints: 100,
      contactIdx: 0, // Arun Sharma as referrer
      notes: "Met at Sharma wedding, interested in booking for daughter's reception.",
    },
    {
      referralCode: "VG-REF-002",
      referralLink: "https://veloriagrand.com/refer/VG-REF-002",
      referredName: "Harsh Malhotra",
      referredEmail: "harsh.m@email.com",
      referredPhone: "+91 9912345678",
      source: "PLANNER" as const,
      status: "BOOKING_CONFIRMED" as const,
      rewardPoints: 100,
      contactIdx: 9, // Pooja Mehta as referrer
      notes: "Recommended by Pooja after birthday event. Looking for corporate event space.",
    },
    {
      referralCode: "VG-REF-003",
      referralLink: "https://veloriagrand.com/refer/VG-REF-003",
      referredName: "Preethi Nayar",
      referredEmail: "preethi.n@email.com",
      referredPhone: null,
      source: "GUEST" as const,
      status: "LEAD_CREATED" as const,
      rewardPoints: null,
      contactIdx: 3, // Meera Nair as referrer
      notes: "College friend of Meera, planning an engagement.",
    },
    {
      referralCode: "VG-REF-004",
      referralLink: "https://veloriagrand.com/refer/VG-REF-004",
      referredName: "Ajay Bhatnagar",
      referredEmail: "ajay.b@company.com",
      referredPhone: "+91 9934567890",
      source: "VENDOR_REF" as const,
      status: "CONTACTED" as const,
      rewardPoints: null,
      contactIdx: 5, // Sunita Joshi as referrer
      notes: "Vendor referral from Royal Caterers. Planning annual day celebration.",
    },
    {
      referralCode: "VG-REF-005",
      referralLink: "https://veloriagrand.com/refer/VG-REF-005",
      referredName: "Simran Oberoi",
      referredEmail: "simran.o@email.com",
      referredPhone: "+91 9945678901",
      source: "EMPLOYEE" as const,
      status: "PENDING" as const,
      rewardPoints: null,
      contactIdx: 7, // Anjali Singh as referrer
      notes: "Staff referral from Vikram. Bride-to-be looking for wedding venue.",
    },
    {
      referralCode: "VG-REF-006",
      referralLink: "https://veloriagrand.com/refer/VG-REF-006",
      referredName: "Rohit Saxena",
      referredEmail: "rohit.s@email.com",
      referredPhone: "+91 9956789012",
      source: "GUEST" as const,
      status: "EXPIRED" as const,
      rewardPoints: null,
      contactIdx: 4, // Rahul Verma as referrer
      notes: "Referred 3 months ago but never followed up. Expired.",
    },
    {
      referralCode: "VG-REF-007",
      referralLink: "https://veloriagrand.com/refer/VG-REF-007",
      referredName: "Kavita Reddy",
      referredEmail: "kavita.r@email.com",
      referredPhone: null,
      source: "PLANNER" as const,
      status: "PENDING" as const,
      rewardPoints: null,
      contactIdx: 8, // Manoj Tiwari as referrer
      notes: "Corporate event planner referred by Global Firm partner.",
    },
    {
      referralCode: "VG-REF-008",
      referralLink: "https://veloriagrand.com/refer/VG-REF-008",
      referredName: "Deepak Malhotra",
      referredEmail: "deepak.m@email.com",
      referredPhone: "+91 9967890123",
      source: "GUEST" as const,
      status: "CANCELLED" as const,
      rewardPoints: null,
      contactIdx: 10, // Sanjay Kapoor as referrer
      notes: "Changed plans and decided to host abroad.",
    },
  ];

  const referrals = await prisma.$transaction(
    referralsData.map((r, idx) =>
      prisma.referral.create({
        data: {
          referralCode: r.referralCode,
          referralLink: r.referralLink,
          referredName: r.referredName,
          referredEmail: r.referredEmail,
          referredPhone: r.referredPhone,
          source: r.source,
          status: r.status,
          rewardPoints: r.rewardPoints,
          notes: r.notes,
          referrerContactId: contacts[r.contactIdx].id,
          createdAt: subDays(now, 30 - idx * 3),
        },
      })
    )
  );

  console.log(`Created ${referrals.length} referrals.\n`);

  // ============================================================
  // 17. Create SOP Templates (3 templates with phases & tasks)
  // ============================================================
  console.log("Creating SOP templates...");

  // --- Template 1: Grand Wedding SOP ---
  const weddingSOP = await prisma.sOPTemplate.create({
    data: {
      name: "Grand Wedding SOP",
      description: "Comprehensive standard operating procedure for large-scale wedding events at Veloria Grand. Covers all phases from pre-event preparation through handover.",
      eventType: "Wedding",
      isActive: true,
      isDefault: true,
    },
  });

  const weddingPhases = await prisma.$transaction([
    prisma.sOPPhase.create({
      data: {
        name: "Pre-Event Preparation",
        phase: "PRE_EVENT",
        order: 0,
        description: "Tasks to be completed 24-48 hours before the event. Includes final vendor confirmations, inventory checks, and team briefings.",
        templateId: weddingSOP.id,
      },
    }),
    prisma.sOPPhase.create({
      data: {
        name: "Venue Setup",
        phase: "SETUP",
        order: 1,
        description: "Day-of setup starting 6 hours before guest arrival. Decoration, AV, catering stations, and stage setup.",
        templateId: weddingSOP.id,
      },
    }),
    prisma.sOPPhase.create({
      data: {
        name: "Guest Arrival & Registration",
        phase: "GUEST_ARRIVAL",
        order: 2,
        description: "Managing guest arrival, welcome drinks, seating guidance, and VIP handling.",
        templateId: weddingSOP.id,
      },
    }),
    prisma.sOPPhase.create({
      data: {
        name: "Live Ceremony & Reception",
        phase: "LIVE_EVENT",
        order: 3,
        description: "Main event execution including ceremony, entertainment, food service, and photography coordination.",
        templateId: weddingSOP.id,
      },
    }),
    prisma.sOPPhase.create({
      data: {
        name: "Wrap-Up & Cleanup",
        phase: "WRAP_UP",
        order: 4,
        description: "Post-event dismantling, inventory return, venue cleanup, and damage inspection.",
        templateId: weddingSOP.id,
      },
    }),
    prisma.sOPPhase.create({
      data: {
        name: "Handover & Closure",
        phase: "HANDOVER",
        order: 5,
        description: "Final handover to client, feedback collection, vendor settlement, and event documentation.",
        templateId: weddingSOP.id,
      },
    }),
  ]);

  // Wedding SOP task definitions
  const weddingTaskDefs = [
    // PRE_EVENT tasks
    { phaseIdx: 0, title: "Confirm all vendor arrivals & timings", category: "LOGISTICS" as const, priority: "URGENT" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: false, order: 0, checklistItems: JSON.parse(JSON.stringify(["Caterer confirmed", "Decorator confirmed", "Photographer confirmed", "DJ/Band confirmed", "Florist confirmed"])) },
    { phaseIdx: 0, title: "Conduct team briefing with run sheet", category: "GENERAL" as const, priority: "HIGH" as const, estimatedMinutes: 45, isMandatory: true, requiresProof: false, order: 1, checklistItems: JSON.parse(JSON.stringify(["Distribute run sheets", "Assign roles", "Emergency protocol review", "Radio check"])) },
    { phaseIdx: 0, title: "Verify inventory & supplies", category: "LOGISTICS" as const, priority: "HIGH" as const, estimatedMinutes: 90, isMandatory: true, requiresProof: true, order: 2, checklistItems: JSON.parse(JSON.stringify(["Chairs & tables count", "Linen check", "Crockery count", "AV equipment test"])) },
    { phaseIdx: 0, title: "Final security briefing & access control setup", category: "SECURITY" as const, priority: "HIGH" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: false, order: 3, checklistItems: null },
    // SETUP tasks
    { phaseIdx: 1, title: "Stage & mandap decoration", category: "DECOR" as const, priority: "URGENT" as const, estimatedMinutes: 180, isMandatory: true, requiresApproval: true, requiresProof: true, order: 0, checklistItems: JSON.parse(JSON.stringify(["Mandap structure erected", "Floral arrangements placed", "Lighting installed", "Client walkthrough & approval"])) },
    { phaseIdx: 1, title: "Table & seating arrangement", category: "GUEST_SEATING" as const, priority: "HIGH" as const, estimatedMinutes: 120, isMandatory: true, requiresProof: true, order: 1, checklistItems: JSON.parse(JSON.stringify(["Tables positioned per layout", "Chair covers & sashes", "Place cards set", "VIP section marked"])) },
    { phaseIdx: 1, title: "AV & sound system setup", category: "AV" as const, priority: "URGENT" as const, estimatedMinutes: 90, isMandatory: true, requiresProof: false, order: 2, checklistItems: JSON.parse(JSON.stringify(["Speakers positioned", "Mic check", "Background music ready", "Projector tested"])) },
    { phaseIdx: 1, title: "Catering station setup & food prep verification", category: "CATERING" as const, priority: "URGENT" as const, estimatedMinutes: 120, isMandatory: true, requiresProof: true, order: 3, checklistItems: JSON.parse(JSON.stringify(["Buffet stations ready", "Chafing dishes heated", "Bar setup complete", "Welcome drinks prepared"])) },
    { phaseIdx: 1, title: "Lighting & ambiance final check", category: "AV" as const, priority: "HIGH" as const, estimatedMinutes: 45, isMandatory: false, requiresProof: true, order: 4, checklistItems: null },
    // GUEST_ARRIVAL tasks
    { phaseIdx: 2, title: "Welcome desk & registration setup", category: "GUEST_SEATING" as const, priority: "HIGH" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: false, order: 0, checklistItems: JSON.parse(JSON.stringify(["Guest list printed", "Name badges ready", "Welcome kits arranged"])) },
    { phaseIdx: 2, title: "Valet parking coordination", category: "LOGISTICS" as const, priority: "HIGH" as const, estimatedMinutes: 15, isMandatory: true, requiresProof: false, order: 1, checklistItems: null },
    { phaseIdx: 2, title: "Welcome drinks service", category: "CATERING" as const, priority: "MEDIUM" as const, estimatedMinutes: 60, isMandatory: false, requiresProof: false, order: 2, checklistItems: null },
    { phaseIdx: 2, title: "VIP guest escort to reserved seating", category: "GUEST_SEATING" as const, priority: "HIGH" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: false, order: 3, checklistItems: null },
    // LIVE_EVENT tasks
    { phaseIdx: 3, title: "Ceremony coordination & cue management", category: "ENTERTAINMENT" as const, priority: "URGENT" as const, estimatedMinutes: 120, isMandatory: true, requiresProof: false, order: 0, checklistItems: JSON.parse(JSON.stringify(["Bride/groom entry cues", "Rituals sequence timing", "Music cues synced", "Photography angles coordinated"])) },
    { phaseIdx: 3, title: "Multi-course dinner service", category: "CATERING" as const, priority: "URGENT" as const, estimatedMinutes: 150, isMandatory: true, requiresProof: false, order: 1, checklistItems: JSON.parse(JSON.stringify(["Starters served", "Main course served", "Dessert station opened", "Buffet replenished"])) },
    { phaseIdx: 3, title: "Entertainment & DJ performance", category: "ENTERTAINMENT" as const, priority: "HIGH" as const, estimatedMinutes: 180, isMandatory: false, requiresProof: false, order: 2, checklistItems: null },
    { phaseIdx: 3, title: "Real-time photography & videography", category: "GENERAL" as const, priority: "HIGH" as const, estimatedMinutes: 240, isMandatory: true, requiresProof: true, order: 3, checklistItems: null },
    // WRAP_UP tasks
    { phaseIdx: 4, title: "Guest departure management", category: "LOGISTICS" as const, priority: "HIGH" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: false, order: 0, checklistItems: JSON.parse(JSON.stringify(["Return gifts distributed", "Valet retrieval smooth", "VIP farewell"])) },
    { phaseIdx: 4, title: "Venue cleanup & dismantling", category: "HOUSEKEEPING" as const, priority: "HIGH" as const, estimatedMinutes: 120, isMandatory: true, requiresProof: true, order: 1, checklistItems: JSON.parse(JSON.stringify(["Decoration removed", "Tables & chairs stacked", "Floor swept & mopped", "Restrooms cleaned"])) },
    { phaseIdx: 4, title: "Inventory return & damage check", category: "LOGISTICS" as const, priority: "MEDIUM" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: true, order: 2, checklistItems: null },
    // HANDOVER tasks
    { phaseIdx: 5, title: "Client feedback & satisfaction check", category: "GENERAL" as const, priority: "HIGH" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: false, order: 0, checklistItems: null },
    { phaseIdx: 5, title: "Vendor settlement & invoice collection", category: "GENERAL" as const, priority: "MEDIUM" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: true, order: 1, checklistItems: JSON.parse(JSON.stringify(["Caterer invoice collected", "Decorator invoice collected", "Entertainment invoice collected", "All amounts verified"])) },
    { phaseIdx: 5, title: "Post-event report generation", category: "GENERAL" as const, priority: "LOW" as const, estimatedMinutes: 45, isMandatory: false, requiresProof: false, order: 2, checklistItems: null },
  ];

  for (const td of weddingTaskDefs) {
    await prisma.sOPTaskDefinition.create({
      data: {
        title: td.title,
        category: td.category,
        priority: td.priority,
        estimatedMinutes: td.estimatedMinutes,
        isMandatory: td.isMandatory,
        requiresApproval: (td as Record<string, unknown>).requiresApproval === true,
        requiresProof: td.requiresProof,
        order: td.order,
        checklistItems: td.checklistItems,
        phaseId: weddingPhases[td.phaseIdx].id,
      },
    });
  }

  // --- Template 2: Corporate Event SOP ---
  const corporateSOP = await prisma.sOPTemplate.create({
    data: {
      name: "Corporate Event SOP",
      description: "Standard operating procedure for corporate events, conferences, and product launches. Focuses on AV setup, registration, and professional service delivery.",
      eventType: "Corporate Event",
      isActive: true,
      isDefault: false,
    },
  });

  const corpPhases = await prisma.$transaction([
    prisma.sOPPhase.create({
      data: { name: "Pre-Event Logistics", phase: "PRE_EVENT", order: 0, description: "Technical setup verifications, branding material preparation, and vendor coordination.", templateId: corporateSOP.id },
    }),
    prisma.sOPPhase.create({
      data: { name: "Venue & Tech Setup", phase: "SETUP", order: 1, description: "AV installation, stage branding, registration desk, and seating arrangement.", templateId: corporateSOP.id },
    }),
    prisma.sOPPhase.create({
      data: { name: "Registration & Networking", phase: "GUEST_ARRIVAL", order: 2, description: "Attendee check-in, badge distribution, and networking area management.", templateId: corporateSOP.id },
    }),
    prisma.sOPPhase.create({
      data: { name: "Main Event & Sessions", phase: "LIVE_EVENT", order: 3, description: "Keynote sessions, panel discussions, product demos, and live streaming.", templateId: corporateSOP.id },
    }),
    prisma.sOPPhase.create({
      data: { name: "Wrap-Up", phase: "WRAP_UP", order: 4, description: "Equipment teardown, venue restoration, and attendee departure.", templateId: corporateSOP.id },
    }),
  ]);

  const corpTaskDefs = [
    { phaseIdx: 0, title: "Verify AV equipment & backup systems", category: "AV" as const, priority: "URGENT" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: true, order: 0, checklistItems: JSON.parse(JSON.stringify(["Projector tested", "Backup laptop ready", "Screen sharing verified", "Recording setup confirmed"])) },
    { phaseIdx: 0, title: "Confirm branding materials delivery", category: "DECOR" as const, priority: "HIGH" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: true, order: 1, checklistItems: null },
    { phaseIdx: 0, title: "WiFi & network stress test", category: "AV" as const, priority: "HIGH" as const, estimatedMinutes: 45, isMandatory: true, requiresProof: false, order: 2, checklistItems: null },
    { phaseIdx: 1, title: "Stage setup with backdrop & branding", category: "DECOR" as const, priority: "URGENT" as const, estimatedMinutes: 120, isMandatory: true, requiresApproval: true, requiresProof: true, order: 0, checklistItems: JSON.parse(JSON.stringify(["Backdrop installed", "Podium placed", "Teleprompter ready", "Branding aligned"])) },
    { phaseIdx: 1, title: "Conference seating arrangement", category: "GUEST_SEATING" as const, priority: "HIGH" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: true, order: 1, checklistItems: null },
    { phaseIdx: 1, title: "Registration desk & badge station setup", category: "LOGISTICS" as const, priority: "HIGH" as const, estimatedMinutes: 45, isMandatory: true, requiresProof: false, order: 2, checklistItems: JSON.parse(JSON.stringify(["Tablets charged", "Badge printer tested", "Attendee list loaded", "Swag bags ready"])) },
    { phaseIdx: 1, title: "Coffee & refreshment stations", category: "CATERING" as const, priority: "MEDIUM" as const, estimatedMinutes: 30, isMandatory: false, requiresProof: false, order: 3, checklistItems: null },
    { phaseIdx: 2, title: "Manage attendee check-in flow", category: "GUEST_SEATING" as const, priority: "HIGH" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: false, order: 0, checklistItems: null },
    { phaseIdx: 2, title: "VIP & speaker escort to green room", category: "LOGISTICS" as const, priority: "URGENT" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: false, order: 1, checklistItems: null },
    { phaseIdx: 3, title: "Keynote session AV management", category: "AV" as const, priority: "URGENT" as const, estimatedMinutes: 90, isMandatory: true, requiresProof: false, order: 0, checklistItems: JSON.parse(JSON.stringify(["Mic levels set", "Slides loaded", "Recording started", "Live stream active"])) },
    { phaseIdx: 3, title: "Lunch/dinner service coordination", category: "CATERING" as const, priority: "HIGH" as const, estimatedMinutes: 90, isMandatory: true, requiresProof: false, order: 1, checklistItems: null },
    { phaseIdx: 3, title: "Panel discussion facilitation", category: "ENTERTAINMENT" as const, priority: "HIGH" as const, estimatedMinutes: 60, isMandatory: false, requiresProof: false, order: 2, checklistItems: null },
    { phaseIdx: 4, title: "Equipment teardown & packing", category: "LOGISTICS" as const, priority: "HIGH" as const, estimatedMinutes: 90, isMandatory: true, requiresProof: true, order: 0, checklistItems: null },
    { phaseIdx: 4, title: "Venue cleanup & restoration", category: "HOUSEKEEPING" as const, priority: "MEDIUM" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: true, order: 1, checklistItems: null },
  ];

  for (const td of corpTaskDefs) {
    await prisma.sOPTaskDefinition.create({
      data: {
        title: td.title,
        category: td.category,
        priority: td.priority,
        estimatedMinutes: td.estimatedMinutes,
        isMandatory: td.isMandatory,
        requiresApproval: (td as Record<string, unknown>).requiresApproval === true,
        requiresProof: td.requiresProof,
        order: td.order,
        checklistItems: td.checklistItems,
        phaseId: corpPhases[td.phaseIdx].id,
      },
    });
  }

  // --- Template 3: Birthday / Social Event SOP ---
  const birthdaySOP = await prisma.sOPTemplate.create({
    data: {
      name: "Birthday & Social Event SOP",
      description: "Streamlined SOP for birthday parties, anniversaries, engagements, and smaller social gatherings. Fewer phases, quicker turnaround.",
      eventType: "Birthday Party",
      isActive: true,
      isDefault: false,
    },
  });

  const bDayPhases = await prisma.$transaction([
    prisma.sOPPhase.create({
      data: { name: "Preparation", phase: "PRE_EVENT", order: 0, description: "Pre-event checks and confirmations.", templateId: birthdaySOP.id },
    }),
    prisma.sOPPhase.create({
      data: { name: "Setup & Decoration", phase: "SETUP", order: 1, description: "Venue decoration, food prep, and entertainment setup.", templateId: birthdaySOP.id },
    }),
    prisma.sOPPhase.create({
      data: { name: "Event Execution", phase: "LIVE_EVENT", order: 2, description: "Guest management, food service, cake cutting, entertainment.", templateId: birthdaySOP.id },
    }),
    prisma.sOPPhase.create({
      data: { name: "Wrap-Up & Handover", phase: "WRAP_UP", order: 3, description: "Cleanup, guest departure, and return of materials.", templateId: birthdaySOP.id },
    }),
  ]);

  const bDayTaskDefs = [
    { phaseIdx: 0, title: "Confirm cake & special items delivery", category: "CATERING" as const, priority: "URGENT" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: true, order: 0, checklistItems: JSON.parse(JSON.stringify(["Cake design confirmed", "Delivery time confirmed", "Special dietary items ordered"])) },
    { phaseIdx: 0, title: "Verify party supplies & props", category: "LOGISTICS" as const, priority: "HIGH" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: false, order: 1, checklistItems: null },
    { phaseIdx: 1, title: "Theme decoration setup", category: "DECOR" as const, priority: "URGENT" as const, estimatedMinutes: 120, isMandatory: true, requiresApproval: true, requiresProof: true, order: 0, checklistItems: JSON.parse(JSON.stringify(["Balloon arch", "Photo booth backdrop", "Table centerpieces", "Birthday banner"])) },
    { phaseIdx: 1, title: "Food & beverage station setup", category: "CATERING" as const, priority: "HIGH" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: false, order: 1, checklistItems: null },
    { phaseIdx: 1, title: "Music & entertainment prep", category: "ENTERTAINMENT" as const, priority: "MEDIUM" as const, estimatedMinutes: 45, isMandatory: false, requiresProof: false, order: 2, checklistItems: null },
    { phaseIdx: 2, title: "Guest welcome & seating", category: "GUEST_SEATING" as const, priority: "HIGH" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: false, order: 0, checklistItems: null },
    { phaseIdx: 2, title: "Cake cutting & special moments coordination", category: "ENTERTAINMENT" as const, priority: "URGENT" as const, estimatedMinutes: 30, isMandatory: true, requiresProof: true, order: 1, checklistItems: null },
    { phaseIdx: 2, title: "Food service management", category: "CATERING" as const, priority: "HIGH" as const, estimatedMinutes: 90, isMandatory: true, requiresProof: false, order: 2, checklistItems: null },
    { phaseIdx: 3, title: "Return gifts distribution", category: "LOGISTICS" as const, priority: "MEDIUM" as const, estimatedMinutes: 20, isMandatory: false, requiresProof: false, order: 0, checklistItems: null },
    { phaseIdx: 3, title: "Venue cleanup", category: "HOUSEKEEPING" as const, priority: "HIGH" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: true, order: 1, checklistItems: null },
  ];

  for (const td of bDayTaskDefs) {
    await prisma.sOPTaskDefinition.create({
      data: {
        title: td.title,
        category: td.category,
        priority: td.priority,
        estimatedMinutes: td.estimatedMinutes,
        isMandatory: td.isMandatory,
        requiresApproval: (td as Record<string, unknown>).requiresApproval === true,
        requiresProof: td.requiresProof,
        order: td.order,
        checklistItems: td.checklistItems,
        phaseId: bDayPhases[td.phaseIdx].id,
      },
    });
  }

  console.log("Created 3 SOP templates with phases & task definitions.\n");

  // ============================================================
  // 18. Create Execution Plans (for 2 upcoming confirmed bookings)
  // ============================================================
  console.log("Creating execution plans...");

  // --- Execution Plan for Sharma-Patel Wedding (bookings[0]) ---
  const weddingPlan = await prisma.executionPlan.create({
    data: {
      status: "READY",
      eventDate: bookingsData[0].date,
      startTime: "14:00",
      endTime: "23:00",
      notes: "Sharma-Patel Wedding — Grand Ballroom, 400 guests. High-profile event — zero tolerance for delays.",
      bookingId: bookings[0].id,
      sopTemplateId: weddingSOP.id,
      createdById: eventCoordinator.id,
    },
  });

  const weddingExecPhases = await prisma.$transaction([
    prisma.executionPhase.create({
      data: { name: "Pre-Event Preparation", phase: "PRE_EVENT", order: 0, status: "COMPLETED", plannedStart: addHours(bookingsData[0].date, 8), plannedEnd: addHours(bookingsData[0].date, 12), planId: weddingPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Venue Setup", phase: "SETUP", order: 1, status: "IN_PROGRESS", plannedStart: addHours(bookingsData[0].date, 12), plannedEnd: addHours(bookingsData[0].date, 17), planId: weddingPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Guest Arrival", phase: "GUEST_ARRIVAL", order: 2, status: "NOT_STARTED", plannedStart: addHours(bookingsData[0].date, 17), plannedEnd: addHours(bookingsData[0].date, 18), planId: weddingPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Live Ceremony", phase: "LIVE_EVENT", order: 3, status: "NOT_STARTED", plannedStart: addHours(bookingsData[0].date, 18), plannedEnd: addHours(bookingsData[0].date, 22), planId: weddingPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Wrap-Up", phase: "WRAP_UP", order: 4, status: "NOT_STARTED", plannedStart: addHours(bookingsData[0].date, 22), plannedEnd: addHours(bookingsData[0].date, 23), planId: weddingPlan.id },
    }),
  ]);

  // Execution tasks for Wedding
  const weddingExecTasks = [
    // PRE_EVENT phase (COMPLETED)
    { phaseIdx: 0, title: "Confirm all vendor arrivals", category: "LOGISTICS" as const, priority: "URGENT" as const, status: "COMPLETED" as const, estimatedMinutes: 60, isMandatory: true, order: 0, assigneeId: eventCoordinator.id, vendorId: null },
    { phaseIdx: 0, title: "Team briefing & run-sheet distribution", category: "GENERAL" as const, priority: "HIGH" as const, status: "COMPLETED" as const, estimatedMinutes: 45, isMandatory: true, order: 1, assigneeId: eventCoordinator.id, vendorId: null },
    { phaseIdx: 0, title: "Inventory & supplies verification", category: "LOGISTICS" as const, priority: "HIGH" as const, status: "COMPLETED" as const, estimatedMinutes: 90, isMandatory: true, requiresProof: true, order: 2, assigneeId: staff.id, vendorId: null },
    // SETUP phase (IN_PROGRESS — mix of statuses)
    { phaseIdx: 1, title: "Stage & mandap decoration", category: "DECOR" as const, priority: "URGENT" as const, status: "COMPLETED" as const, estimatedMinutes: 180, isMandatory: true, requiresApproval: true, requiresProof: true, order: 0, assigneeId: null, vendorId: vendors[1].id },
    { phaseIdx: 1, title: "Table & seating arrangement", category: "GUEST_SEATING" as const, priority: "HIGH" as const, status: "IN_PROGRESS" as const, estimatedMinutes: 120, isMandatory: true, requiresProof: true, order: 1, assigneeId: staff.id, vendorId: null },
    { phaseIdx: 1, title: "AV & sound system setup", category: "AV" as const, priority: "URGENT" as const, status: "IN_PROGRESS" as const, estimatedMinutes: 90, isMandatory: true, order: 2, assigneeId: null, vendorId: vendors[3].id },
    { phaseIdx: 1, title: "Catering station setup", category: "CATERING" as const, priority: "URGENT" as const, status: "NOT_STARTED" as const, estimatedMinutes: 120, isMandatory: true, requiresProof: true, order: 3, assigneeId: null, vendorId: vendors[0].id },
    { phaseIdx: 1, title: "Floral arrangements placement", category: "DECOR" as const, priority: "HIGH" as const, status: "DELAYED" as const, estimatedMinutes: 60, isMandatory: false, order: 4, assigneeId: null, vendorId: vendors[4].id, delayReason: "Delivery truck delayed in traffic — ETA 30 min" },
    // GUEST_ARRIVAL phase (NOT_STARTED)
    { phaseIdx: 2, title: "Welcome desk setup", category: "GUEST_SEATING" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 30, isMandatory: true, order: 0, assigneeId: staff.id, vendorId: null },
    { phaseIdx: 2, title: "Valet parking coordination", category: "LOGISTICS" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 15, isMandatory: true, order: 1, assigneeId: null, vendorId: vendors[5].id },
    // LIVE_EVENT phase (NOT_STARTED)
    { phaseIdx: 3, title: "Ceremony coordination", category: "ENTERTAINMENT" as const, priority: "URGENT" as const, status: "NOT_STARTED" as const, estimatedMinutes: 120, isMandatory: true, order: 0, assigneeId: eventCoordinator.id, vendorId: null },
    { phaseIdx: 3, title: "Dinner service", category: "CATERING" as const, priority: "URGENT" as const, status: "NOT_STARTED" as const, estimatedMinutes: 150, isMandatory: true, order: 1, assigneeId: null, vendorId: vendors[0].id },
    { phaseIdx: 3, title: "DJ & entertainment", category: "ENTERTAINMENT" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 180, isMandatory: false, order: 2, assigneeId: null, vendorId: vendors[6].id },
    // WRAP_UP phase (NOT_STARTED)
    { phaseIdx: 4, title: "Venue cleanup & dismantling", category: "HOUSEKEEPING" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 120, isMandatory: true, requiresProof: true, order: 0, assigneeId: null, vendorId: vendors[7].id },
    { phaseIdx: 4, title: "Inventory return check", category: "LOGISTICS" as const, priority: "MEDIUM" as const, status: "NOT_STARTED" as const, estimatedMinutes: 60, isMandatory: true, requiresProof: true, order: 1, assigneeId: staff.id, vendorId: null },
  ];

  for (const t of weddingExecTasks) {
    const slaStart = weddingExecPhases[t.phaseIdx].plannedStart ?? addHours(bookingsData[0].date, 8);
    const slaFinish = new Date(slaStart.getTime() + (t.estimatedMinutes ?? 60) * 60 * 1000);
    await prisma.executionTask.create({
      data: {
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        estimatedMinutes: t.estimatedMinutes,
        isMandatory: t.isMandatory,
        requiresApproval: (t as Record<string, unknown>).requiresApproval === true,
        requiresProof: (t as Record<string, unknown>).requiresProof === true,
        order: t.order,
        slaStartBy: slaStart,
        slaFinishBy: slaFinish,
        actualStart: t.status === "COMPLETED" || t.status === "IN_PROGRESS" ? slaStart : null,
        actualEnd: t.status === "COMPLETED" ? new Date(slaFinish.getTime() - 5 * 60 * 1000) : null,
        delayReason: (t as Record<string, unknown>).delayReason as string | undefined,
        phaseId: weddingExecPhases[t.phaseIdx].id,
        assigneeId: t.assigneeId,
        vendorId: t.vendorId,
      },
    });
  }

  // --- Execution Plan for StartupX Product Launch (bookings[1]) ---
  const corpPlan = await prisma.executionPlan.create({
    data: {
      status: "PLANNING",
      eventDate: bookingsData[1].date,
      startTime: "08:00",
      endTime: "17:00",
      notes: "StartupX Product Launch — Garden Terrace, 200 guests. Focus on AV and tech setup.",
      bookingId: bookings[1].id,
      sopTemplateId: corporateSOP.id,
      createdById: eventCoordinator.id,
    },
  });

  const corpExecPhases = await prisma.$transaction([
    prisma.executionPhase.create({
      data: { name: "Pre-Event Logistics", phase: "PRE_EVENT", order: 0, status: "NOT_STARTED", plannedStart: addHours(bookingsData[1].date, 6), plannedEnd: addHours(bookingsData[1].date, 8), planId: corpPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Venue & Tech Setup", phase: "SETUP", order: 1, status: "NOT_STARTED", plannedStart: addHours(bookingsData[1].date, 8), plannedEnd: addHours(bookingsData[1].date, 10), planId: corpPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Registration", phase: "GUEST_ARRIVAL", order: 2, status: "NOT_STARTED", plannedStart: addHours(bookingsData[1].date, 10), plannedEnd: addHours(bookingsData[1].date, 11), planId: corpPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Main Sessions", phase: "LIVE_EVENT", order: 3, status: "NOT_STARTED", plannedStart: addHours(bookingsData[1].date, 11), plannedEnd: addHours(bookingsData[1].date, 16), planId: corpPlan.id },
    }),
    prisma.executionPhase.create({
      data: { name: "Wrap-Up", phase: "WRAP_UP", order: 4, status: "NOT_STARTED", plannedStart: addHours(bookingsData[1].date, 16), plannedEnd: addHours(bookingsData[1].date, 17), planId: corpPlan.id },
    }),
  ]);

  const corpExecTasks = [
    { phaseIdx: 0, title: "AV equipment verification", category: "AV" as const, priority: "URGENT" as const, status: "NOT_STARTED" as const, estimatedMinutes: 60, isMandatory: true, order: 0, assigneeId: null, vendorId: vendors[3].id },
    { phaseIdx: 0, title: "Branding materials check", category: "DECOR" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 30, isMandatory: true, order: 1, assigneeId: staff.id, vendorId: null },
    { phaseIdx: 1, title: "Stage setup with branding", category: "DECOR" as const, priority: "URGENT" as const, status: "NOT_STARTED" as const, estimatedMinutes: 120, isMandatory: true, order: 0, assigneeId: null, vendorId: vendors[1].id },
    { phaseIdx: 1, title: "Registration desk setup", category: "LOGISTICS" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 45, isMandatory: true, order: 1, assigneeId: staff.id, vendorId: null },
    { phaseIdx: 1, title: "Coffee station setup", category: "CATERING" as const, priority: "MEDIUM" as const, status: "NOT_STARTED" as const, estimatedMinutes: 30, isMandatory: false, order: 2, assigneeId: null, vendorId: vendors[0].id },
    { phaseIdx: 2, title: "Attendee check-in management", category: "GUEST_SEATING" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 60, isMandatory: true, order: 0, assigneeId: staff.id, vendorId: null },
    { phaseIdx: 3, title: "Keynote AV management", category: "AV" as const, priority: "URGENT" as const, status: "NOT_STARTED" as const, estimatedMinutes: 90, isMandatory: true, order: 0, assigneeId: null, vendorId: vendors[3].id },
    { phaseIdx: 3, title: "Lunch service coordination", category: "CATERING" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 90, isMandatory: true, order: 1, assigneeId: null, vendorId: vendors[0].id },
    { phaseIdx: 4, title: "Equipment teardown", category: "LOGISTICS" as const, priority: "HIGH" as const, status: "NOT_STARTED" as const, estimatedMinutes: 90, isMandatory: true, order: 0, assigneeId: staff.id, vendorId: null },
    { phaseIdx: 4, title: "Venue cleanup", category: "HOUSEKEEPING" as const, priority: "MEDIUM" as const, status: "NOT_STARTED" as const, estimatedMinutes: 60, isMandatory: true, order: 1, assigneeId: null, vendorId: vendors[7].id },
  ];

  for (const t of corpExecTasks) {
    const slaStart = corpExecPhases[t.phaseIdx].plannedStart ?? addHours(bookingsData[1].date, 6);
    const slaFinish = new Date(slaStart.getTime() + (t.estimatedMinutes ?? 60) * 60 * 1000);
    await prisma.executionTask.create({
      data: {
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        estimatedMinutes: t.estimatedMinutes,
        isMandatory: t.isMandatory,
        order: t.order,
        slaStartBy: slaStart,
        slaFinishBy: slaFinish,
        phaseId: corpExecPhases[t.phaseIdx].id,
        assigneeId: t.assigneeId,
        vendorId: t.vendorId,
      },
    });
  }

  console.log("Created 2 execution plans with phases & tasks.\n");

  // ============================================================
  // 19. Create Referral Reward Rules
  // ============================================================
  console.log("Creating referral reward rules...");

  const referralRewardRules = await prisma.referralRewardRule.createManyAndReturn({
    data: [
      {
        name: "Standard Booking Referral",
        description: "Award points when a referred lead confirms a booking at Veloria Grand.",
        triggerEvent: "BOOKING_CONFIRMED",
        rewardType: "POINTS",
        rewardValue: 500,
        minBookingValue: 100000,
        tierLevel: 1,
        isActive: true,
      },
      {
        name: "High-Value Booking Bonus",
        description: "Extra cash reward for referrals that result in bookings above ₹10,00,000.",
        triggerEvent: "HIGH_VALUE_BOOKING",
        rewardType: "CASH",
        rewardValue: 10000,
        minBookingValue: 1000000,
        bonusMultiplier: 1.5,
        tierLevel: 2,
        isActive: true,
      },
      {
        name: "Premium Wedding Referral",
        description: "Premium reward for wedding bookings above ₹20,00,000 referred by existing clients.",
        triggerEvent: "HIGH_VALUE_BOOKING",
        rewardType: "CASH",
        rewardValue: 25000,
        minBookingValue: 2000000,
        bonusMultiplier: 2.0,
        tierLevel: 3,
        isActive: true,
      },
      {
        name: "Repeat Referrer Loyalty Bonus",
        description: "Bonus points for referrers who have sent 3+ successful referrals.",
        triggerEvent: "REPEAT_REFERRAL",
        rewardType: "POINTS",
        rewardValue: 1000,
        tierLevel: 2,
        isActive: true,
      },
      {
        name: "Vendor Cross-Referral Discount",
        description: "Service discount for vendors who refer clients that book at Veloria Grand.",
        triggerEvent: "BOOKING_CONFIRMED",
        rewardType: "DISCOUNT",
        rewardValue: 5000,
        minBookingValue: 200000,
        tierLevel: 1,
        isActive: true,
      },
      {
        name: "Employee Referral Incentive",
        description: "Cash bonus for employees who bring in confirmed bookings through personal networks.",
        triggerEvent: "BOOKING_CONFIRMED",
        rewardType: "CASH",
        rewardValue: 5000,
        minBookingValue: 300000,
        tierLevel: 1,
        isActive: true,
      },
    ],
  });

  console.log(`Created ${referralRewardRules.length} referral reward rules.\n`);

  // ============================================================
  // 20. Create Referral Assets (shareable marketing materials)
  // ============================================================
  console.log("Creating referral assets...");

  const referralAssets = await prisma.referralAsset.createManyAndReturn({
    data: [
      {
        title: "Wedding Season Referral Card",
        description: "Beautiful referral card for sharing during wedding season. Features Veloria Grand ballroom with referral code overlay.",
        type: "IMAGE",
        fileUrl: "/assets/referral/wedding-season-card.jpg",
        isActive: true,
      },
      {
        title: "Corporate Event Flyer",
        description: "Professional flyer showcasing Veloria Grand's corporate event capabilities with referral incentive details.",
        type: "FLYER",
        fileUrl: "/assets/referral/corporate-event-flyer.pdf",
        isActive: true,
      },
      {
        title: "Social Media Share Card — Instagram",
        description: "Instagram-optimized square card with Veloria Grand branding and referral code placeholder.",
        type: "SOCIAL_CARD",
        fileUrl: "/assets/referral/ig-share-card.jpg",
        isActive: true,
      },
      {
        title: "WhatsApp Referral Banner",
        description: "Compact banner optimized for WhatsApp sharing. Includes venue photos and referral link.",
        type: "IMAGE",
        fileUrl: "/assets/referral/whatsapp-banner.jpg",
        isActive: true,
      },
      {
        title: "Referral Program Brochure",
        description: "Detailed brochure explaining the referral program tiers, rewards, and how to participate.",
        type: "FLYER",
        fileUrl: "/assets/referral/referral-program-brochure.pdf",
        isActive: true,
      },
    ],
  });

  console.log(`Created ${referralAssets.length} referral assets.\n`);

  // ============================================================
  // 21. Create Performance Scores (last 2 months for staff & vendors)
  // ============================================================
  console.log("Creating performance scores...");

  const lastMonth = subMonths(now, 1);
  const twoMonthsAgo = subMonths(now, 2);
  const lastMonthPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  const twoMonthsPeriod = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

  const performanceScoresData = [
    // Event Coordinator — last 2 months
    { userId: eventCoordinator.id, vendorId: null, period: lastMonthPeriod, onTimeRate: 92.5, qualityScore: 88.0, reworkCount: 1, escalationCount: 2, avgResponseMinutes: 8, totalTasksCompleted: 45, totalTasksAssigned: 48, overallScore: 90.0 },
    { userId: eventCoordinator.id, vendorId: null, period: twoMonthsPeriod, onTimeRate: 88.0, qualityScore: 85.0, reworkCount: 3, escalationCount: 4, avgResponseMinutes: 12, totalTasksCompleted: 38, totalTasksAssigned: 42, overallScore: 85.5 },
    // Staff — last 2 months
    { userId: staff.id, vendorId: null, period: lastMonthPeriod, onTimeRate: 85.0, qualityScore: 90.0, reworkCount: 0, escalationCount: 1, avgResponseMinutes: 5, totalTasksCompleted: 30, totalTasksAssigned: 32, overallScore: 87.0 },
    { userId: staff.id, vendorId: null, period: twoMonthsPeriod, onTimeRate: 80.0, qualityScore: 82.0, reworkCount: 2, escalationCount: 3, avgResponseMinutes: 10, totalTasksCompleted: 25, totalTasksAssigned: 30, overallScore: 79.5 },
    // Admin — last month
    { userId: admin.id, vendorId: null, period: lastMonthPeriod, onTimeRate: 95.0, qualityScore: 92.0, reworkCount: 0, escalationCount: 0, avgResponseMinutes: 6, totalTasksCompleted: 20, totalTasksAssigned: 20, overallScore: 95.0 },
    // Royal Caterers (vendor)
    { userId: null, vendorId: vendors[0].id, period: lastMonthPeriod, onTimeRate: 90.0, qualityScore: 95.0, reworkCount: 0, escalationCount: 1, avgResponseMinutes: 10, totalTasksCompleted: 18, totalTasksAssigned: 20, overallScore: 92.0 },
    { userId: null, vendorId: vendors[0].id, period: twoMonthsPeriod, onTimeRate: 88.0, qualityScore: 90.0, reworkCount: 1, escalationCount: 2, avgResponseMinutes: 15, totalTasksCompleted: 15, totalTasksAssigned: 18, overallScore: 87.0 },
    // Sparkle Décor Studio (vendor)
    { userId: null, vendorId: vendors[1].id, period: lastMonthPeriod, onTimeRate: 78.0, qualityScore: 92.0, reworkCount: 2, escalationCount: 3, avgResponseMinutes: 18, totalTasksCompleted: 12, totalTasksAssigned: 15, overallScore: 80.0 },
    // Lens & Light Photography (vendor)
    { userId: null, vendorId: vendors[2].id, period: lastMonthPeriod, onTimeRate: 98.0, qualityScore: 97.0, reworkCount: 0, escalationCount: 0, avgResponseMinutes: 3, totalTasksCompleted: 10, totalTasksAssigned: 10, overallScore: 98.0 },
    // SoundWave Productions (vendor)
    { userId: null, vendorId: vendors[3].id, period: lastMonthPeriod, onTimeRate: 85.0, qualityScore: 88.0, reworkCount: 1, escalationCount: 2, avgResponseMinutes: 12, totalTasksCompleted: 8, totalTasksAssigned: 10, overallScore: 84.0 },
    // Elite Security Services (vendor)
    { userId: null, vendorId: vendors[5].id, period: lastMonthPeriod, onTimeRate: 94.0, qualityScore: 90.0, reworkCount: 0, escalationCount: 1, avgResponseMinutes: 4, totalTasksCompleted: 14, totalTasksAssigned: 15, overallScore: 91.0 },
    // Star Entertainment (vendor)
    { userId: null, vendorId: vendors[6].id, period: lastMonthPeriod, onTimeRate: 100.0, qualityScore: 95.0, reworkCount: 0, escalationCount: 0, avgResponseMinutes: 5, totalTasksCompleted: 6, totalTasksAssigned: 6, overallScore: 97.0 },
  ];

  const performanceScores = [];
  for (const ps of performanceScoresData) {
    const score = await prisma.performanceScore.create({
      data: {
        period: ps.period,
        onTimeRate: ps.onTimeRate,
        qualityScore: ps.qualityScore,
        reworkCount: ps.reworkCount,
        escalationCount: ps.escalationCount,
        avgResponseMinutes: ps.avgResponseMinutes,
        totalTasksCompleted: ps.totalTasksCompleted,
        totalTasksAssigned: ps.totalTasksAssigned,
        overallScore: ps.overallScore,
        userId: ps.userId,
        vendorId: ps.vendorId,
      },
    });
    performanceScores.push(score);
  }

  console.log(`Created ${performanceScores.length} performance scores.\n`);

  // ============================================================
  // 22. Create Badges
  // ============================================================
  console.log("Creating badges...");

  const badgesData = [
    { type: "ZERO_ESCALATION" as const, title: "Zero Escalation Hero", description: "Completed all tasks in the period with zero escalations.", userId: admin.id, vendorId: null, period: lastMonthPeriod },
    { type: "TOP_PERFORMER" as const, title: "Top Performer", description: "Highest overall score among all staff for the period.", userId: eventCoordinator.id, vendorId: null, period: lastMonthPeriod },
    { type: "SPEED_STAR" as const, title: "Speed Star", description: "Fastest average response time across all assigned tasks.", userId: staff.id, vendorId: null, period: lastMonthPeriod },
    { type: "RELIABILITY_KING" as const, title: "Reliability King", description: "100% on-time delivery rate for all assigned tasks.", userId: null, vendorId: vendors[6].id, period: lastMonthPeriod },
    { type: "QUALITY_CHAMPION" as const, title: "Quality Champion", description: "Highest quality score among all vendors with zero rework.", userId: null, vendorId: vendors[2].id, period: lastMonthPeriod },
    { type: "TOP_PERFORMER" as const, title: "Top Vendor", description: "Highest overall performance score among all vendors.", userId: null, vendorId: vendors[2].id, period: lastMonthPeriod },
    { type: "MONTHLY_BEST" as const, title: "Monthly Best — Catering", description: "Best performing catering vendor of the month.", userId: null, vendorId: vendors[0].id, period: lastMonthPeriod },
    { type: "ZERO_ESCALATION" as const, title: "Zero Escalation", description: "Zero escalations during the entire month.", userId: null, vendorId: vendors[2].id, period: twoMonthsPeriod },
  ];

  const badges = await prisma.$transaction(
    badgesData.map((b) =>
      prisma.badge.create({
        data: {
          type: b.type,
          title: b.title,
          description: b.description,
          userId: b.userId,
          vendorId: b.vendorId,
          period: b.period,
          earnedAt: b.period === lastMonthPeriod ? startOfMonth(lastMonth) : startOfMonth(twoMonthsAgo),
        },
      })
    )
  );

  console.log(`Created ${badges.length} badges.\n`);

  // ============================================================
  // 23. Create Performance Incentives
  // ============================================================
  console.log("Creating performance incentives...");

  const incentivesData = [
    {
      title: "Star Performer Bonus — Q4",
      description: "Quarterly bonus for the highest overall performance score among staff. Awarded to the coordinator who maintained 90%+ score consistently.",
      points: 500,
      bonusAmount: 15000,
      period: lastMonthPeriod,
      isAwarded: true,
      awardedAt: startOfMonth(now),
      userId: eventCoordinator.id,
      vendorId: null,
    },
    {
      title: "Zero Escalation Incentive",
      description: "Bonus for maintaining zero escalations throughout the month while handling 20+ tasks.",
      points: 300,
      bonusAmount: 5000,
      period: lastMonthPeriod,
      isAwarded: true,
      awardedAt: startOfMonth(now),
      userId: admin.id,
      vendorId: null,
    },
    {
      title: "Fastest Responder Award",
      description: "Recognition for consistently fast response times (under 5 min average) on execution tasks.",
      points: 200,
      bonusAmount: null,
      period: lastMonthPeriod,
      isAwarded: true,
      awardedAt: startOfMonth(now),
      userId: staff.id,
      vendorId: null,
    },
    {
      title: "Best Vendor — Photography",
      description: "Lens & Light Photography achieved a perfect 98% overall score with zero rework and zero escalations.",
      points: 500,
      bonusAmount: 10000,
      period: lastMonthPeriod,
      isAwarded: true,
      awardedAt: startOfMonth(now),
      userId: null,
      vendorId: vendors[2].id,
    },
    {
      title: "Best Vendor — Catering",
      description: "Royal Caterers maintained consistent quality with 92% overall score across 20 tasks.",
      points: 400,
      bonusAmount: 8000,
      period: lastMonthPeriod,
      isAwarded: true,
      awardedAt: startOfMonth(now),
      userId: null,
      vendorId: vendors[0].id,
    },
    {
      title: "Improvement Bonus — Décor",
      description: "Incentive to encourage Sparkle Décor to improve on-time delivery rate from 78% to 90%+.",
      points: 0,
      bonusAmount: 5000,
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      isAwarded: false,
      awardedAt: null,
      userId: null,
      vendorId: vendors[1].id,
    },
    {
      title: "Reliability Award — Security",
      description: "Elite Security consistently delivered 94%+ on-time rate with excellent crowd management.",
      points: 350,
      bonusAmount: 7000,
      period: lastMonthPeriod,
      isAwarded: true,
      awardedAt: startOfMonth(now),
      userId: null,
      vendorId: vendors[5].id,
    },
  ];

  const incentives = [];
  for (const inc of incentivesData) {
    const incentive = await prisma.performanceIncentive.create({
      data: {
        title: inc.title,
        description: inc.description,
        points: inc.points,
        bonusAmount: inc.bonusAmount,
        period: inc.period,
        isAwarded: inc.isAwarded,
        awardedAt: inc.awardedAt,
        userId: inc.userId,
        vendorId: inc.vendorId,
      },
    });
    incentives.push(incentive);
  }

  console.log(`Created ${incentives.length} performance incentives.\n`);

  // ============================================================
  // 24. Create Workflows & Workflow Logs
  // ============================================================
  console.log("Creating workflows...");

  const workflowsData: {
    name: string;
    trigger: "EVENT_CREATED" | "BOOKING_CONFIRMED" | "PAYMENT_DUE" | "EVENT_TOMORROW" | "POST_EVENT";
    isActive: boolean;
    delayMinutes: number | null;
    actions: { type: string; config: Record<string, string> }[];
  }[] = [
    {
      name: "New Event Setup Checklist",
      trigger: "EVENT_CREATED",
      isActive: true,
      delayMinutes: null,
      actions: [
        { type: "CREATE_TASK", config: { title: "Prepare venue layout and seating plan" } },
        { type: "CREATE_TASK", config: { title: "Assign event coordinator and brief the team" } },
        { type: "SEND_NOTIFICATION", config: { message: "New event created: {{event.name}}. Setup tasks have been generated." } },
      ],
    },
    {
      name: "Client Welcome Email",
      trigger: "EVENT_CREATED",
      isActive: true,
      delayMinutes: 5,
      actions: [
        { type: "SEND_EMAIL", config: { template: "welcome_new_event", to: "{{contact.email}}" } },
      ],
    },
    {
      name: "Booking Confirmation Flow",
      trigger: "BOOKING_CONFIRMED",
      isActive: true,
      delayMinutes: null,
      actions: [
        { type: "SEND_EMAIL", config: { template: "booking_confirmation", to: "{{contact.email}}" } },
        { type: "CREATE_TASK", config: { title: "Send booking confirmation package to client" } },
        { type: "SEND_NOTIFICATION", config: { message: "Booking confirmed for {{event.name}}. Confirmation email sent to client." } },
        { type: "UPDATE_STATUS", config: { status: "CONFIRMED" } },
      ],
    },
    {
      name: "Vendor Coordination Kickoff",
      trigger: "BOOKING_CONFIRMED",
      isActive: true,
      delayMinutes: 30,
      actions: [
        { type: "CREATE_TASK", config: { title: "Contact preferred vendors and check availability" } },
        { type: "CREATE_TASK", config: { title: "Request catering menu options from vendor" } },
        { type: "SEND_NOTIFICATION", config: { message: "Vendor coordination tasks created for {{event.name}}. Please begin outreach." } },
      ],
    },
    {
      name: "Payment Due Reminder",
      trigger: "PAYMENT_DUE",
      isActive: true,
      delayMinutes: null,
      actions: [
        { type: "SEND_EMAIL", config: { template: "payment_reminder", to: "{{contact.email}}" } },
        { type: "SEND_NOTIFICATION", config: { message: "Payment reminder sent to client for {{event.name}}." } },
      ],
    },
    {
      name: "Overdue Payment Escalation",
      trigger: "PAYMENT_DUE",
      isActive: true,
      delayMinutes: 1440,
      actions: [
        { type: "SEND_EMAIL", config: { template: "payment_overdue_notice", to: "{{contact.email}}" } },
        { type: "CREATE_TASK", config: { title: "Follow up on overdue payment — call client" } },
        { type: "SEND_NOTIFICATION", config: { message: "URGENT: Payment overdue for {{event.name}}. Follow-up task created." } },
      ],
    },
    {
      name: "Day-Before Event Preparation",
      trigger: "EVENT_TOMORROW",
      isActive: true,
      delayMinutes: null,
      actions: [
        { type: "SEND_EMAIL", config: { template: "event_tomorrow_reminder", to: "{{contact.email}}" } },
        { type: "CREATE_TASK", config: { title: "Final venue walkthrough and setup verification" } },
        { type: "CREATE_TASK", config: { title: "Confirm all vendor arrivals and delivery times" } },
        { type: "SEND_NOTIFICATION", config: { message: "Event {{event.name}} is tomorrow! Final prep tasks created. Verify all arrangements." } },
      ],
    },
    {
      name: "Event Tomorrow — Staff Alert",
      trigger: "EVENT_TOMORROW",
      isActive: false,
      delayMinutes: 60,
      actions: [
        { type: "SEND_NOTIFICATION", config: { message: "REMINDER: You are assigned to {{event.name}} tomorrow. Please confirm your attendance." } },
        { type: "CREATE_TASK", config: { title: "Print and distribute run-of-show documents" } },
      ],
    },
    {
      name: "Post-Event Follow-Up",
      trigger: "POST_EVENT",
      isActive: true,
      delayMinutes: 120,
      actions: [
        { type: "SEND_EMAIL", config: { template: "post_event_thank_you", to: "{{contact.email}}" } },
        { type: "CREATE_TASK", config: { title: "Collect client feedback and satisfaction survey" } },
        { type: "CREATE_TASK", config: { title: "Process final vendor payments and settle invoices" } },
        { type: "SEND_NOTIFICATION", config: { message: "Post-event tasks created for {{event.name}}. Send thank-you note and request feedback." } },
      ],
    },
    {
      name: "Post-Event Review & Archive",
      trigger: "POST_EVENT",
      isActive: false,
      delayMinutes: 4320,
      actions: [
        { type: "CREATE_TASK", config: { title: "Compile event photos and create portfolio entry" } },
        { type: "UPDATE_STATUS", config: { status: "COMPLETED" } },
        { type: "SEND_NOTIFICATION", config: { message: "Event {{event.name}} has been archived. Portfolio and review tasks generated." } },
      ],
    },
  ];

  const workflows = [];
  for (const wf of workflowsData) {
    const workflow = await prisma.workflow.create({
      data: {
        name: wf.name,
        trigger: wf.trigger,
        isActive: wf.isActive,
        delayMinutes: wf.delayMinutes,
        actions: wf.actions,
      },
    });
    workflows.push(workflow);
  }

  console.log(`Created ${workflows.length} workflows.\n`);

  // --- Workflow Logs (execution history) ---
  console.log("Creating workflow logs...");

  const workflowLogsData = [
    // Booking Confirmation Flow (workflows[2]) — full successful run
    { workflowIdx: 2, action: "SEND_EMAIL", status: "SUCCESS" as const, executedAt: subDays(now, 18), error: null, bookingId: bookings[0].id, contactId: contacts[0].id },
    { workflowIdx: 2, action: "CREATE_TASK", status: "SUCCESS" as const, executedAt: subDays(now, 18), error: null, bookingId: bookings[0].id, contactId: contacts[0].id },
    { workflowIdx: 2, action: "SEND_NOTIFICATION", status: "SUCCESS" as const, executedAt: subDays(now, 18), error: null, bookingId: bookings[0].id, contactId: contacts[0].id },
    { workflowIdx: 2, action: "UPDATE_STATUS", status: "SUCCESS" as const, executedAt: subDays(now, 18), error: null, bookingId: bookings[0].id, contactId: contacts[0].id },
    // Payment Due Reminder (workflows[4]) — successful run
    { workflowIdx: 4, action: "SEND_EMAIL", status: "SUCCESS" as const, executedAt: subDays(now, 10), error: null, bookingId: bookings[0].id, contactId: contacts[0].id },
    { workflowIdx: 4, action: "SEND_NOTIFICATION", status: "SUCCESS" as const, executedAt: subDays(now, 10), error: null, bookingId: bookings[0].id, contactId: contacts[0].id },
    // Overdue Payment Escalation (workflows[5]) — partial failure
    { workflowIdx: 5, action: "SEND_EMAIL", status: "FAILED" as const, executedAt: subDays(now, 9), error: "SMTP connection timeout: unable to reach mail server", bookingId: bookings[1].id, contactId: contacts[4].id },
    { workflowIdx: 5, action: "CREATE_TASK", status: "SUCCESS" as const, executedAt: subDays(now, 9), error: null, bookingId: bookings[1].id, contactId: contacts[4].id },
  ];

  const workflowLogs = [];
  for (const log of workflowLogsData) {
    const wfLog = await prisma.workflowLog.create({
      data: {
        workflowId: workflows[log.workflowIdx].id,
        action: log.action,
        status: log.status,
        executedAt: log.executedAt,
        error: log.error,
        bookingId: log.bookingId,
        contactId: log.contactId,
      },
    });
    workflowLogs.push(wfLog);
  }

  console.log(`Created ${workflowLogs.length} workflow logs.\n`);

  // ============================================================
  // 25. Create Emergency Protocols & Incidents
  // ============================================================
  console.log("Creating emergency protocols...");

  const emergencyProtocolsData = [
    {
      name: "Fire Evacuation Plan",
      type: "FIRE",
      venueId: venues[0].id, // Grand Ballroom
      procedures: `1. Activate the fire alarm and call 101 (Fire Services) immediately.\n2. Announce evacuation via PA system — direct guests to nearest marked exits.\n3. Designated fire wardens guide guests to Assembly Point A (front parking area).\n4. Security team sweeps all restrooms, green rooms, and backstage areas.\n5. Cut main power supply from the electrical panel room (Ground Floor, Room G-12).\n6. Account for all staff using the duty roster checklist.\n7. Do NOT use elevators — stairwells only.\n8. Fire warden reports headcount to the Incident Commander at the assembly point.\n9. Await Fire Department arrival — do NOT re-enter the building until cleared.\n10. Document the incident and file report within 24 hours.`,
      contactNumbers: [
        { name: "Fire Department", phone: "+91 101", role: "Emergency Services" },
        { name: "Rajesh Kumar", phone: "+91 98765 43210", role: "Fire Warden — Grand Ballroom" },
        { name: "Sunil Mehta", phone: "+91 98765 43211", role: "Venue Manager" },
        { name: "Control Room", phone: "+91 98765 00001", role: "24/7 Monitoring" },
      ],
      isActive: true,
      lastReviewedAt: subDays(now, 15),
    },
    {
      name: "Medical Emergency Response",
      type: "MEDICAL",
      venueId: null, // Applies to all venues
      procedures: `1. Assess the situation — check if the person is conscious and breathing.\n2. Call 108 (Ambulance) immediately for serious injuries or cardiac events.\n3. Alert the on-site first aid team via radio (Channel 3).\n4. Retrieve the nearest first aid kit and AED (Automated External Defibrillator).\n   - AED locations: Main lobby, Grand Ballroom entrance, Kitchen corridor.\n5. If trained, begin CPR or first aid while waiting for paramedics.\n6. Clear the area around the patient — maintain at least 3 meters of space.\n7. Assign a staff member to meet the ambulance at the main gate and guide them in.\n8. Collect patient details if possible — name, known allergies, medications.\n9. Notify the event host discreetly — avoid causing panic among guests.\n10. Complete the Medical Incident Report Form within 2 hours.`,
      contactNumbers: [
        { name: "Ambulance", phone: "+91 108", role: "Emergency Medical Services" },
        { name: "Dr. Priya Sharma", phone: "+91 97654 32100", role: "On-Call Doctor" },
        { name: "First Aid Team", phone: "+91 97654 32101", role: "In-House Medical" },
        { name: "Apollo Hospital (Nearest)", phone: "+91 44 2829 3333", role: "Nearest Hospital" },
      ],
      isActive: true,
      lastReviewedAt: subDays(now, 10),
    },
    {
      name: "Severe Weather Protocol",
      type: "WEATHER",
      venueId: venues[1].id, // Garden Terrace (outdoor venue)
      procedures: `1. Monitor weather forecasts 48 hours before every outdoor event.\n2. If thunderstorm/heavy rain warning issued — activate Indoor Backup Plan.\n3. Announce to guests: move to the Crystal Banquet Hall (indoor backup venue).\n4. Secure all outdoor equipment — tie down tents, canopies, and décor items.\n5. Disconnect all outdoor electrical equipment and cover sound systems.\n6. Move food service stations indoors immediately.\n7. Security team patrols for fallen branches, flooding, or structural damage.\n8. If lightning detected within 10 km — suspend all outdoor activities.\n9. Resume outdoor activities only 30 minutes after last lightning strike.\n10. Document weather-related changes and notify the client of all adjustments.`,
      contactNumbers: [
        { name: "Weather Helpline", phone: "+91 1800 180 1717", role: "IMD Weather Updates" },
        { name: "Amit Patel", phone: "+91 96543 21098", role: "Outdoor Events Manager" },
        { name: "Maintenance Team", phone: "+91 96543 21099", role: "Grounds & Equipment" },
      ],
      isActive: true,
      lastReviewedAt: subDays(now, 30),
    },
    {
      name: "Security Breach & Threat Response",
      type: "SECURITY",
      venueId: null, // Applies to all venues
      procedures: `1. Alert the Security Control Room immediately via radio (Channel 1 — Priority).\n2. Do NOT confront the intruder or threat — observe and report from a safe distance.\n3. Security team assesses the threat level:\n   - Level 1 (Low): Unauthorized entry — escort out, log incident.\n   - Level 2 (Medium): Aggressive behavior — isolate, call local police (100).\n   - Level 3 (High): Armed threat/bomb threat — initiate full evacuation.\n4. For Level 3: Activate PA system evacuation announcement (Code Red).\n5. Security locks down entry/exit points and controls crowd movement.\n6. Call Police (100) and provide: location, nature of threat, number of people.\n7. Designate a staff liaison to meet police at the main gate.\n8. Preserve any evidence — do not touch or move suspicious items.\n9. Account for all guests and staff at the assembly point.\n10. Cooperate fully with law enforcement upon arrival.`,
      contactNumbers: [
        { name: "Police", phone: "+91 100", role: "Law Enforcement" },
        { name: "Vijay Singh", phone: "+91 95432 10987", role: "Head of Security" },
        { name: "Control Room", phone: "+91 98765 00001", role: "24/7 Security Monitoring" },
        { name: "Women Helpline", phone: "+91 181", role: "Women Safety" },
      ],
      isActive: true,
      lastReviewedAt: subDays(now, 7),
    },
    {
      name: "Power Outage Recovery Plan",
      type: "POWER_OUTAGE",
      venueId: null, // Applies to all venues
      procedures: `1. Emergency lighting activates automatically — verify all areas are lit.\n2. Maintenance team checks the main electrical panel (Ground Floor, Room G-12).\n3. Start the backup diesel generator within 2 minutes.\n   - Generator location: Utility block behind the parking area.\n   - Fuel reserve: minimum 8 hours at full load.\n4. Prioritize power to: emergency lights, kitchen refrigeration, PA system, security cameras.\n5. Announce to guests via battery-powered megaphone — reassure and provide updates.\n6. If generator fails: contact electricity board emergency line.\n7. Keep elevator rescue team on standby — check all elevators for trapped persons.\n8. Kitchen staff secures all perishable food items in insulated containers.\n9. Event coordinator communicates timeline to the host for guest updates.\n10. Once main power is restored — test all systems before resuming normal operations.`,
      contactNumbers: [
        { name: "Electricity Board", phone: "+91 1912", role: "Power Utility" },
        { name: "Ravi Electricals", phone: "+91 94321 09876", role: "Electrical Contractor" },
        { name: "Maintenance Head", phone: "+91 94321 09877", role: "Facilities Manager" },
      ],
      isActive: true,
      lastReviewedAt: subDays(now, 20),
    },
    {
      name: "Food Safety & Contamination Response",
      type: "OTHER",
      venueId: null, // Applies to all venues
      procedures: `1. If a guest reports food poisoning symptoms — isolate the affected food immediately.\n2. Do NOT dispose of the suspected food — seal and label for testing.\n3. Alert the on-site first aid team and assess the guest's condition.\n4. If multiple guests affected — call 108 (Ambulance) and notify the nearest hospital.\n5. Stop service of the suspected food item across all stations.\n6. Kitchen manager identifies the batch, ingredients, and preparation timeline.\n7. Collect food samples from all served items for laboratory testing.\n8. Document names and contact details of all affected guests.\n9. Notify the Food Safety Department (FSSAI) if required by regulation.\n10. Arrange alternative food service from a pre-approved backup caterer.\n11. Issue a formal communication to the event host with full transparency.\n12. Conduct internal review within 48 hours and update food safety protocols.`,
      contactNumbers: [
        { name: "Food Safety (FSSAI)", phone: "+91 1800 112 100", role: "Food Safety Authority" },
        { name: "Dr. Priya Sharma", phone: "+91 97654 32100", role: "On-Call Doctor" },
        { name: "Kitchen Manager", phone: "+91 93210 98765", role: "Head Chef" },
        { name: "Backup Caterer", phone: "+91 93210 98766", role: "Emergency Catering" },
      ],
      isActive: true,
      lastReviewedAt: subDays(now, 45),
    },
    {
      name: "VIP Guest Protection Protocol",
      type: "SECURITY",
      venueId: venues[0].id, // Grand Ballroom
      procedures: `1. Pre-event: Receive VIP guest list and security requirements 72 hours in advance.\n2. Coordinate with personal security teams of VIP guests for entry logistics.\n3. Designate a private VIP entrance (Side Gate B) — separate from general guest flow.\n4. Assign a dedicated security escort for each VIP from arrival to departure.\n5. Sweep the VIP lounge and green room 2 hours before arrival.\n6. Restrict photography near VIP areas — brief event photographers on boundaries.\n7. Monitor social media for any location leaks or security concerns.\n8. Emergency extraction route: VIP Lounge → Service corridor → Basement parking → Exit Gate C.\n9. Keep a vehicle on standby at Exit Gate C for immediate departure if needed.\n10. Debrief security team post-event and file VIP security report.`,
      contactNumbers: [
        { name: "Vijay Singh", phone: "+91 95432 10987", role: "Head of Security" },
        { name: "VIP Liaison", phone: "+91 95432 10988", role: "Guest Relations Manager" },
        { name: "Police (Special Branch)", phone: "+91 100", role: "VIP Protection Unit" },
      ],
      isActive: true,
      lastReviewedAt: subDays(now, 5),
    },
    {
      name: "Earthquake Response Plan",
      type: "OTHER",
      venueId: null, // Applies to all venues
      procedures: `1. During shaking: Announce "DROP, COVER, and HOLD ON" via PA system.\n2. Staff guides guests under sturdy tables or against interior walls — away from windows.\n3. Do NOT attempt evacuation during active shaking.\n4. After shaking stops: Check for injuries and provide first aid.\n5. Maintenance team inspects structural integrity — look for cracks, gas leaks, water damage.\n6. If building is structurally compromised — evacuate to Assembly Point A (open parking area).\n7. Turn off gas supply at the main valve (Kitchen corridor, marked red).\n8. Check for fire hazards — gas leaks, electrical shorts, broken water lines.\n9. Do NOT re-enter the building until structural engineer clears it.\n10. Monitor for aftershocks — remain at assembly point for minimum 30 minutes.\n11. Contact NDRF if major structural damage or persons trapped.`,
      contactNumbers: [
        { name: "NDRF", phone: "+91 9711077372", role: "National Disaster Response" },
        { name: "Police", phone: "+91 100", role: "Emergency Services" },
        { name: "Structural Engineer", phone: "+91 92109 87654", role: "Building Safety" },
        { name: "Gas Utility", phone: "+91 1906", role: "Gas Emergency" },
      ],
      isActive: false, // Inactive — region-specific, enable if applicable
      lastReviewedAt: null,
    },
  ];

  const emergencyProtocols = [];
  for (const ep of emergencyProtocolsData) {
    const protocol = await prisma.emergencyProtocol.create({
      data: {
        name: ep.name,
        type: ep.type,
        venueId: ep.venueId,
        procedures: ep.procedures,
        contactNumbers: ep.contactNumbers,
        isActive: ep.isActive,
        lastReviewedAt: ep.lastReviewedAt,
      },
    });
    emergencyProtocols.push(protocol);
  }

  console.log(`Created ${emergencyProtocols.length} emergency protocols.\n`);

  // --- Emergency Incidents ---
  console.log("Creating emergency incidents...");

  const emergencyIncidentsData = [
    {
      protocolIdx: 1, // Medical Emergency Response
      bookingId: bookings[0].id,
      type: "MEDICAL",
      description: "A guest experienced dizziness and shortness of breath during the wedding reception. The on-site first aid team responded within 2 minutes and administered oxygen. Guest was stabilized and chose to remain at the event after resting in the green room for 30 minutes.",
      severity: "MEDIUM",
      status: "RESOLVED",
      resolvedAt: subDays(now, 22),
      notes: "Guest was an elderly gentleman with a pre-existing heart condition. First aid team provided oxygen and monitored vitals. Guest's family was informed and chose to stay. No ambulance required. Recommended adding a medical history question to the RSVP form for elderly guests.",
      reportedById: allUsers[4].id, // events coordinator
      createdAt: subDays(now, 22),
    },
    {
      protocolIdx: 4, // Power Outage Recovery Plan
      bookingId: bookings[1].id,
      type: "POWER_OUTAGE",
      description: "Complete power failure during a corporate gala event at 8:45 PM. Emergency lighting activated successfully. Backup generator started within 90 seconds. Full power restored to all critical systems within 4 minutes. Main grid power returned after 35 minutes.",
      severity: "HIGH",
      status: "RESOLVED",
      resolvedAt: subDays(now, 14),
      notes: "Root cause: transformer failure at the local substation. Generator performed as expected. Client was informed promptly and expressed satisfaction with the rapid response. Recommended increasing diesel reserve from 8 hours to 12 hours. Maintenance team to schedule quarterly generator load tests.",
      reportedById: allUsers[1].id, // admin
      createdAt: subDays(now, 14),
    },
    {
      protocolIdx: 3, // Security Breach & Threat Response
      bookingId: bookings[2].id,
      type: "SECURITY",
      description: "Unauthorized individual attempted to enter the event through the service entrance during a high-profile engagement party. Individual did not have an invitation or ID. Security intercepted at the service corridor before reaching the event hall.",
      severity: "MEDIUM",
      status: "RESOLVED",
      resolvedAt: subDays(now, 8),
      notes: "Individual claimed to be a delivery person but had no delivery order or ID. Security escorted them off premises. CCTV footage saved. Service entrance access protocol updated — all service entries now require advance registration and photo ID. No guests were aware of the incident.",
      reportedById: allUsers[4].id, // events coordinator
      createdAt: subDays(now, 8),
    },
    {
      protocolIdx: 2, // Severe Weather Protocol
      bookingId: bookings[3].id,
      type: "WEATHER",
      description: "Sudden thunderstorm with heavy rain and strong winds during an outdoor anniversary celebration on the Garden Terrace. Weather alert received 45 minutes before onset. Indoor backup plan activated — guests and equipment relocated to Crystal Banquet Hall.",
      severity: "HIGH",
      status: "RESOLVED",
      resolvedAt: subDays(now, 5),
      notes: "All 180 guests safely moved indoors within 20 minutes. Outdoor décor sustained minor damage (estimated ₹15,000). Sound system was covered and protected in time. Client appreciated the swift transition and seamless continuation indoors. Note: always check weather 48 hours AND 12 hours before outdoor events.",
      reportedById: allUsers[4].id, // events coordinator
      createdAt: subDays(now, 5),
    },
    {
      protocolIdx: 0, // Fire Evacuation Plan
      bookingId: null,
      type: "FIRE",
      description: "Smoke detected in the kitchen exhaust system during event preparation. Kitchen staff noticed burning smell from the exhaust duct above the main grill station. No visible flames. Fire alarm triggered in the kitchen zone only.",
      severity: "LOW",
      status: "RESPONDING",
      resolvedAt: null,
      notes: "Maintenance team investigating. Likely cause is grease buildup in the exhaust duct. Kitchen operations temporarily suspended. Portable fire extinguisher on standby. Waiting for maintenance team to complete inspection and cleaning.",
      reportedById: allUsers[1].id, // admin
      createdAt: subDays(now, 1),
    },
    {
      protocolIdx: 5, // Food Safety & Contamination Response
      bookingId: bookings[4].id,
      type: "OTHER",
      description: "Two guests reported mild stomach discomfort approximately 2 hours after dinner service at a birthday celebration. Both had consumed the prawn curry starter. Kitchen immediately sealed the remaining batch for testing.",
      severity: "MEDIUM",
      status: "OPEN",
      resolvedAt: null,
      notes: null,
      reportedById: allUsers[4].id, // events coordinator
      createdAt: subDays(now, 0),
    },
  ];

  const emergencyIncidents = [];
  for (const ei of emergencyIncidentsData) {
    const incident = await prisma.emergencyIncident.create({
      data: {
        protocolId: emergencyProtocols[ei.protocolIdx].id,
        bookingId: ei.bookingId,
        type: ei.type,
        description: ei.description,
        severity: ei.severity,
        status: ei.status,
        resolvedAt: ei.resolvedAt,
        notes: ei.notes,
        reportedById: ei.reportedById,
        createdAt: ei.createdAt,
      },
    });
    emergencyIncidents.push(incident);
  }

  console.log(`Created ${emergencyIncidents.length} emergency incidents.\n`);

  // ============================================================
  // 27. Event Packages & Package Items
  // ============================================================
  console.log("Creating event packages...");

  const eventPackagesData = [
    {
      name: "Silver Wedding Package",
      tier: "BASIC" as const,
      basePrice: 500000,
      eventType: "Wedding",
      description: "An elegant yet affordable wedding package for intimate celebrations.",
      items: [
        { name: "Venue rental", category: "Venue", unitPrice: 150000, order: 1 },
        { name: "Basic décor", category: "Décor", unitPrice: 80000, order: 2 },
        { name: "Catering 200 pax", category: "Catering", unitPrice: 120000, order: 3 },
        { name: "Sound system", category: "Audio", unitPrice: 50000, order: 4 },
        { name: "Photography basic", category: "Photography", unitPrice: 60000, order: 5 },
        { name: "Valet parking", category: "Services", unitPrice: 40000, order: 6 },
      ],
    },
    {
      name: "Gold Wedding Package",
      tier: "STANDARD" as const,
      basePrice: 1200000,
      eventType: "Wedding",
      description: "A premium wedding experience with comprehensive services and elegant arrangements.",
      items: [
        { name: "Grand Ballroom", category: "Venue", unitPrice: 250000, order: 1 },
        { name: "Premium décor", category: "Décor", unitPrice: 200000, order: 2 },
        { name: "Catering 400 pax", category: "Catering", unitPrice: 300000, order: 3 },
        { name: "DJ + Sound", category: "Audio", unitPrice: 100000, order: 4 },
        { name: "Photography + Video", category: "Photography", unitPrice: 150000, order: 5 },
        { name: "Bridal suite", category: "Services", unitPrice: 50000, order: 6 },
        { name: "Valet parking", category: "Services", unitPrice: 50000, order: 7 },
        { name: "Mehendi setup", category: "Décor", unitPrice: 100000, order: 8 },
      ],
    },
    {
      name: "Platinum Celebration Package",
      tier: "PREMIUM" as const,
      basePrice: 2500000,
      eventType: "Wedding",
      description: "The ultimate luxury wedding package with exclusive services and world-class arrangements.",
      items: [
        { name: "Exclusive venue", category: "Venue", unitPrice: 400000, order: 1 },
        { name: "Luxury décor", category: "Décor", unitPrice: 500000, order: 2 },
        { name: "Gourmet catering 500 pax", category: "Catering", unitPrice: 600000, order: 3 },
        { name: "Celebrity DJ", category: "Entertainment", unitPrice: 250000, order: 4 },
        { name: "Cinematic coverage", category: "Photography", unitPrice: 350000, order: 5 },
        { name: "Bridal + VIP lounges", category: "Services", unitPrice: 150000, order: 6 },
        { name: "Fireworks", category: "Effects", unitPrice: 100000, order: 7 },
        { name: "Guest transport", category: "Transport", unitPrice: 150000, order: 8 },
      ],
    },
    {
      name: "Corporate Conference Package",
      tier: "STANDARD" as const,
      basePrice: 800000,
      eventType: "Corporate Event",
      description: "A professional conference package with modern AV setup and seamless coordination.",
      items: [
        { name: "Convention centre", category: "Venue", unitPrice: 300000, order: 1 },
        { name: "AV setup", category: "AV Equipment", unitPrice: 150000, order: 2 },
        { name: "Catering 300 pax", category: "Catering", unitPrice: 200000, order: 3 },
        { name: "Registration desk", category: "Services", unitPrice: 50000, order: 4 },
        { name: "Branding & signage", category: "Marketing", unitPrice: 100000, order: 5 },
      ],
    },
  ];

  const eventPackages = [];
  for (const pkg of eventPackagesData) {
    const { items, ...packageFields } = pkg;
    const created = await prisma.eventPackage.create({
      data: {
        ...packageFields,
        items: { create: items },
      },
    });
    eventPackages.push(created);
  }

  console.log(`Created ${eventPackages.length} event packages.\n`);

  // ============================================================
  // 28. Menu Items & Booking Menus
  // ============================================================
  console.log("Creating menu items...");

  const menuItemsData = [
    { name: "Paneer Tikka", category: "Starters", cuisine: "North Indian", dietaryTags: ["Vegetarian"], pricePerHead: 250 },
    { name: "Chicken Seekh Kebab", category: "Starters", cuisine: "Mughlai", dietaryTags: ["Non-Vegetarian"], pricePerHead: 350 },
    { name: "Dal Makhani", category: "Main Course", cuisine: "North Indian", dietaryTags: ["Vegetarian", "Gluten-Free"], pricePerHead: 200 },
    { name: "Butter Chicken", category: "Main Course", cuisine: "North Indian", dietaryTags: ["Non-Vegetarian"], pricePerHead: 400 },
    { name: "Hyderabadi Biryani", category: "Main Course", cuisine: "Hyderabadi", dietaryTags: ["Non-Vegetarian"], pricePerHead: 450 },
    { name: "Vegetable Biryani", category: "Main Course", cuisine: "Hyderabadi", dietaryTags: ["Vegetarian"], pricePerHead: 350 },
    { name: "Gulab Jamun", category: "Desserts", cuisine: "Indian", dietaryTags: ["Vegetarian"], pricePerHead: 150 },
    { name: "Rasmalai", category: "Desserts", cuisine: "Indian", dietaryTags: ["Vegetarian"], pricePerHead: 180 },
    { name: "Caesar Salad", category: "Starters", cuisine: "Continental", dietaryTags: ["Vegetarian"], pricePerHead: 200 },
    { name: "Grilled Fish", category: "Main Course", cuisine: "Continental", dietaryTags: ["Non-Vegetarian", "Gluten-Free"], pricePerHead: 500 },
    { name: "Masala Dosa", category: "Live Counters", cuisine: "South Indian", dietaryTags: ["Vegetarian"], pricePerHead: 180 },
    { name: "Pani Puri Station", category: "Live Counters", cuisine: "Street Food", dietaryTags: ["Vegetarian"], pricePerHead: 120 },
  ];

  const menuItems = [];
  for (const mi of menuItemsData) {
    const created = await prisma.menuItem.create({ data: mi });
    menuItems.push(created);
  }

  console.log(`Created ${menuItems.length} menu items.\n`);

  console.log("Creating booking menus...");

  const bookingMenu1 = await prisma.bookingMenu.create({
    data: {
      bookingId: bookings[0].id,
      guestCount: 400,
      pricePerHead: 1200,
      totalPrice: 480000,
      specialInstructions: "Jain food counter required. No onion/garlic section needed.",
      selections: {
        create: [
          { menuItemId: menuItems[0].id, order: 1 },
          { menuItemId: menuItems[1].id, order: 2 },
          { menuItemId: menuItems[2].id, order: 3 },
          { menuItemId: menuItems[3].id, order: 4 },
          { menuItemId: menuItems[4].id, order: 5 },
          { menuItemId: menuItems[5].id, order: 6 },
          { menuItemId: menuItems[6].id, order: 7 },
          { menuItemId: menuItems[7].id, order: 8 },
        ],
      },
    },
  });

  const bookingMenu2 = await prisma.bookingMenu.create({
    data: {
      bookingId: bookings[7].id,
      guestCount: 350,
      pricePerHead: 900,
      totalPrice: 315000,
      specialInstructions: "Cocktail-style service preferred. Live counters mandatory.",
      selections: {
        create: [
          { menuItemId: menuItems[0].id, order: 1 },
          { menuItemId: menuItems[8].id, order: 2 },
          { menuItemId: menuItems[3].id, order: 3 },
          { menuItemId: menuItems[9].id, order: 4 },
          { menuItemId: menuItems[10].id, order: 5 },
          { menuItemId: menuItems[11].id, order: 6 },
        ],
      },
    },
  });

  const bookingMenus = [bookingMenu1, bookingMenu2];

  console.log(`Created ${bookingMenus.length} booking menus.\n`);

  console.log("Creating menu tastings...");

  const menuTasting1 = await prisma.menuTasting.create({
    data: {
      bookingId: bookings[0].id,
      contactId: contacts[0].id,
      venueId: venues[0].id,
      scheduledDate: addDays(now, 2),
      scheduledTime: "11:00 AM",
      status: "SCHEDULED",
      selectedItems: [
        { name: "Paneer Tikka" },
        { name: "Butter Chicken" },
        { name: "Hyderabadi Biryani" },
        { name: "Gulab Jamun" },
      ],
    },
  });

  console.log(`Created 1 menu tasting.\n`);

  // ============================================================
  // 29. Pricing Rules & Rate Plans
  // ============================================================
  console.log("Creating pricing rules...");

  const pricingRulesData = [
    { name: "Weekend Premium", ruleType: "DAY_OF_WEEK" as const, multiplier: 1.25, dayOfWeek: 6, venueId: venues[0].id },
    { name: "Sunday Premium", ruleType: "DAY_OF_WEEK" as const, multiplier: 1.20, dayOfWeek: 0, venueId: venues[0].id },
    { name: "Peak Season", ruleType: "SEASONAL" as const, multiplier: 1.35, startDate: new Date(now.getFullYear(), 10, 1), endDate: new Date(now.getFullYear() + 1, 1, 28), venueId: venues[0].id },
    { name: "Early Bird Discount", ruleType: "EARLY_BIRD" as const, multiplier: 0.90, minDaysAhead: 90, venueId: venues[0].id },
    { name: "Last Minute Deal", ruleType: "LAST_MINUTE" as const, multiplier: 0.80, minDaysAhead: null, conditions: { maxDaysAhead: 7 }, venueId: venues[1].id },
    { name: "Evening Premium", ruleType: "PEAK_HOUR" as const, multiplier: 1.15, venueId: venues[1].id },
  ];

  const pricingRules = [];
  for (const pr of pricingRulesData) {
    const created = await prisma.pricingRule.create({ data: pr });
    pricingRules.push(created);
  }

  console.log(`Created ${pricingRules.length} pricing rules.\n`);

  console.log("Creating rate plans...");

  const ratePlansData = [
    { name: "Standard Rate — Grand Ballroom", baseRate: 250000, perGuestRate: 500, isDefault: true, venueId: venues[0].id },
    { name: "Premium Rate — Grand Ballroom", baseRate: 300000, perGuestRate: 650, venueId: venues[0].id },
    { name: "Standard Rate — Garden Terrace", baseRate: 150000, perGuestRate: 400, isDefault: true, venueId: venues[1].id },
    { name: "Corporate Rate — Convention Centre", baseRate: 350000, perGuestRate: 450, venueId: venues[7].id },
  ];

  const ratePlans = [];
  for (const rp of ratePlansData) {
    const created = await prisma.ratePlan.create({ data: rp });
    ratePlans.push(created);
  }

  console.log(`Created ${ratePlans.length} rate plans.\n`);

  // ============================================================
  // 30. Inventory Items & Reservations
  // ============================================================
  console.log("Creating inventory items...");

  const inventoryItemsData = [
    { name: "Round Banquet Table (10-seater)", sku: "INV-TBL-001", category: "Furniture", totalQuantity: 60, availableQty: 45, reorderLevel: 10, unitCost: 8000, location: "Warehouse A" },
    { name: "Chiavari Chair (Gold)", sku: "INV-CHR-001", category: "Furniture", totalQuantity: 500, availableQty: 380, reorderLevel: 50, unitCost: 1500, location: "Warehouse A" },
    { name: "LED Par Light", sku: "INV-LGT-001", category: "Lighting", totalQuantity: 100, availableQty: 72, reorderLevel: 15, unitCost: 5000, location: "AV Room" },
    { name: "Wireless Microphone Set", sku: "INV-AUD-001", category: "Audio", totalQuantity: 20, availableQty: 14, reorderLevel: 5, unitCost: 12000, location: "AV Room" },
    { name: "Table Linen (White)", sku: "INV-LIN-001", category: "Linen", totalQuantity: 100, availableQty: 75, reorderLevel: 20, unitCost: 500, location: "Laundry Store" },
    { name: "Centerpiece Vase (Crystal)", sku: "INV-DEC-001", category: "Décor", totalQuantity: 50, availableQty: 40, reorderLevel: 10, unitCost: 3000, location: "Décor Storage" },
    { name: "Projector (4K)", sku: "INV-AV-001", category: "AV Equipment", totalQuantity: 5, availableQty: 3, reorderLevel: 2, unitCost: 85000, location: "AV Room" },
    { name: "Chafing Dish (Stainless Steel)", sku: "INV-CTR-001", category: "Catering", totalQuantity: 40, availableQty: 30, reorderLevel: 10, unitCost: 4000, location: "Kitchen Store" },
    { name: "Flower Arch Frame", sku: "INV-DEC-002", category: "Décor", totalQuantity: 8, availableQty: 6, reorderLevel: 2, unitCost: 15000, location: "Décor Storage" },
    { name: "Portable Dance Floor Panel", sku: "INV-STG-001", category: "Staging", totalQuantity: 30, availableQty: 22, reorderLevel: 5, unitCost: 6000, location: "Warehouse B" },
  ];

  const inventoryItems = [];
  for (const ii of inventoryItemsData) {
    const created = await prisma.inventoryItem.create({ data: ii });
    inventoryItems.push(created);
  }

  console.log(`Created ${inventoryItems.length} inventory items.\n`);

  console.log("Creating inventory reservations...");

  const inventoryReservationsData = [
    { itemId: inventoryItems[0].id, quantity: 40, date: bookings[0].date, bookingId: bookings[0].id, status: "RESERVED" as const },
    { itemId: inventoryItems[1].id, quantity: 400, date: bookings[0].date, bookingId: bookings[0].id, status: "RESERVED" as const },
    { itemId: inventoryItems[2].id, quantity: 20, date: bookings[7].date, bookingId: bookings[7].id, status: "RESERVED" as const },
    { itemId: inventoryItems[7].id, quantity: 10, date: bookings[6].date, returnDate: addDays(bookings[6].date, 1), bookingId: bookings[6].id, status: "RETURNED" as const },
  ];

  const inventoryReservations = [];
  for (const ir of inventoryReservationsData) {
    const created = await prisma.inventoryReservation.create({ data: ir });
    inventoryReservations.push(created);
  }

  console.log(`Created ${inventoryReservations.length} inventory reservations.\n`);

  // ============================================================
  // 31. Rental Items & Rental Bookings
  // ============================================================
  console.log("Creating rental items...");

  const rentalItemsData = [
    { name: "Luxury Sofa Set (Gold)", category: "Furniture", dailyRate: 5000, weeklyRate: 25000, quantity: 10, availableQty: 7 },
    { name: "Photo Booth Setup", category: "Entertainment", dailyRate: 15000, weeklyRate: 75000, quantity: 4, availableQty: 2 },
    { name: "LED Dance Floor (12x12)", category: "Staging", dailyRate: 20000, weeklyRate: 100000, quantity: 3, availableQty: 1 },
    { name: "Fog Machine", category: "Effects", dailyRate: 3000, quantity: 6, availableQty: 4 },
    { name: "Red Carpet Runner (50ft)", category: "Décor", dailyRate: 2000, weeklyRate: 8000, quantity: 8, availableQty: 6 },
    { name: "Portable Bar Counter", category: "Catering", dailyRate: 8000, weeklyRate: 40000, quantity: 5, availableQty: 3 },
  ];

  const rentalItems = [];
  for (const ri of rentalItemsData) {
    const created = await prisma.rentalItem.create({ data: ri });
    rentalItems.push(created);
  }

  console.log(`Created ${rentalItems.length} rental items.\n`);

  console.log("Creating rental bookings...");

  const rentalBookingsData = [
    { rentalItemId: rentalItems[1].id, quantity: 1, startDate: bookings[0].date, endDate: bookings[0].date, dailyRate: 15000, totalAmount: 15000, bookingId: bookings[0].id, status: "RESERVED" as const },
    { rentalItemId: rentalItems[2].id, quantity: 1, startDate: bookings[7].date, endDate: bookings[7].date, dailyRate: 20000, totalAmount: 20000, bookingId: bookings[7].id, status: "RESERVED" as const },
    { rentalItemId: rentalItems[0].id, quantity: 2, startDate: bookings[6].date, endDate: bookings[6].date, dailyRate: 5000, totalAmount: 10000, bookingId: bookings[6].id, status: "RETURNED" as const },
  ];

  const rentalBookings = [];
  for (const rb of rentalBookingsData) {
    const created = await prisma.rentalBooking.create({ data: rb });
    rentalBookings.push(created);
  }

  console.log(`Created ${rentalBookings.length} rental bookings.\n`);

  // ============================================================
  // 32. Quotes & Quote Line Items
  // ============================================================
  console.log("Creating quotes...");

  const quotesData = [
    {
      quoteNumber: "VG-QT-2026-001",
      title: "Sharma-Patel Wedding — Comprehensive Package",
      status: "CONVERTED" as const,
      validUntil: addDays(now, 30),
      subtotal: 1500000,
      discountPercent: 5,
      discountAmount: 75000,
      taxRate: 18,
      taxAmount: 256500,
      totalAmount: 1681500,
      contactId: contacts[0].id,
      leadId: leads[0].id,
      createdById: allUsers[2].id,
      sentAt: subDays(now, 25),
      viewedAt: subDays(now, 24),
      convertedInvoiceId: invoices[0].id,
      lineItems: [
        { description: "Venue Rental — Grand Ballroom", quantity: 1, unitPrice: 250000, amount: 250000, category: "Venue", order: 1 },
        { description: "Décor Package", quantity: 1, unitPrice: 350000, amount: 350000, category: "Décor", order: 2 },
        { description: "Catering 400 pax", quantity: 400, unitPrice: 1200, amount: 480000, category: "Catering", order: 3 },
        { description: "Photography & Video", quantity: 1, unitPrice: 200000, amount: 200000, category: "Photography", order: 4 },
        { description: "Sound & DJ", quantity: 1, unitPrice: 100000, amount: 100000, category: "Audio", order: 5 },
        { description: "Event Coordination", quantity: 1, unitPrice: 120000, amount: 120000, category: "Services", order: 6 },
      ],
    },
    {
      quoteNumber: "VG-QT-2026-002",
      title: "StartupX Product Launch Event",
      status: "ACCEPTED" as const,
      validUntil: addDays(now, 15),
      subtotal: 600000,
      taxRate: 18,
      taxAmount: 108000,
      totalAmount: 708000,
      contactId: contacts[5].id,
      leadId: leads[4].id,
      createdById: allUsers[2].id,
      sentAt: subDays(now, 18),
      viewedAt: subDays(now, 17),
      lineItems: [
        { description: "Venue Rental — Garden Terrace", quantity: 1, unitPrice: 150000, amount: 150000, category: "Venue", order: 1 },
        { description: "AV Setup", quantity: 1, unitPrice: 150000, amount: 150000, category: "AV Equipment", order: 2 },
        { description: "Catering 200 pax", quantity: 200, unitPrice: 750, amount: 150000, category: "Catering", order: 3 },
        { description: "Branding & Signage", quantity: 1, unitPrice: 100000, amount: 100000, category: "Marketing", order: 4 },
        { description: "Event Coordination", quantity: 1, unitPrice: 50000, amount: 50000, category: "Services", order: 5 },
      ],
    },
    {
      quoteNumber: "VG-QT-2026-003",
      title: "Kapoor Grand Wedding — Premium Package",
      status: "SENT" as const,
      validUntil: addDays(now, 20),
      subtotal: 2500000,
      discountPercent: 3,
      discountAmount: 75000,
      taxRate: 18,
      taxAmount: 436500,
      totalAmount: 2861500,
      contactId: contacts[10].id,
      leadId: leads[9].id,
      createdById: allUsers[3].id,
      sentAt: subDays(now, 3),
      lineItems: [
        { description: "Grand Ballroom Full Day", quantity: 1, unitPrice: 400000, amount: 400000, category: "Venue", order: 1 },
        { description: "Platinum Décor", quantity: 1, unitPrice: 600000, amount: 600000, category: "Décor", order: 2 },
        { description: "Gourmet Catering 500 pax", quantity: 500, unitPrice: 1400, amount: 700000, category: "Catering", order: 3 },
        { description: "Entertainment Package", quantity: 1, unitPrice: 300000, amount: 300000, category: "Entertainment", order: 4 },
        { description: "Photo + Video Cinema", quantity: 1, unitPrice: 400000, amount: 400000, category: "Photography", order: 5 },
        { description: "Guest Transport", quantity: 1, unitPrice: 100000, amount: 100000, category: "Transport", order: 6 },
      ],
    },
    {
      quoteNumber: "VG-QT-2026-004",
      title: "MediaCo Awards Night Proposal",
      status: "DRAFT" as const,
      validUntil: addDays(now, 30),
      subtotal: 1800000,
      taxRate: 18,
      taxAmount: 324000,
      totalAmount: 2124000,
      contactId: contacts[13].id,
      leadId: leads[12].id,
      createdById: allUsers[3].id,
      lineItems: [
        { description: "Grand Ballroom Evening", quantity: 1, unitPrice: 250000, amount: 250000, category: "Venue", order: 1 },
        { description: "Stage & AV", quantity: 1, unitPrice: 350000, amount: 350000, category: "AV Equipment", order: 2 },
        { description: "Catering 350 pax", quantity: 350, unitPrice: 1000, amount: 350000, category: "Catering", order: 3 },
        { description: "Awards Setup", quantity: 1, unitPrice: 200000, amount: 200000, category: "Setup", order: 4 },
        { description: "Red Carpet & Branding", quantity: 1, unitPrice: 150000, amount: 150000, category: "Marketing", order: 5 },
        { description: "Entertainment", quantity: 1, unitPrice: 200000, amount: 200000, category: "Entertainment", order: 6 },
        { description: "Photography", quantity: 1, unitPrice: 150000, amount: 150000, category: "Photography", order: 7 },
      ],
    },
  ];

  const quotes = [];
  for (const q of quotesData) {
    const { lineItems, ...quoteFields } = q;
    const created = await prisma.quote.create({
      data: {
        ...quoteFields,
        lineItems: { create: lineItems },
      },
    });
    quotes.push(created);
  }

  console.log(`Created ${quotes.length} quotes.\n`);

  // ============================================================
  // 33. Contract Templates & Contracts
  // ============================================================
  console.log("Creating contract templates...");

  const contractTemplatesData = [
    {
      name: "Standard Event Booking Agreement",
      category: "Booking",
      variables: ["clientName", "eventName", "eventDate", "venueName", "totalAmount", "depositAmount"],
      content: `EVENT BOOKING AGREEMENT

This Event Booking Agreement ("Agreement") is entered into between Veloria Grand ("Venue Provider") and {{clientName}} ("Client").

1. EVENT DETAILS
   Event Name: {{eventName}}
   Event Date: {{eventDate}}
   Venue: {{venueName}}
   Total Amount: {{totalAmount}}

2. PAYMENT TERMS
   A deposit of {{depositAmount}} is due upon signing this agreement. The remaining balance is due 7 days prior to the event date. All payments are non-refundable unless otherwise specified in the cancellation policy.

3. CANCELLATION POLICY
   Cancellations made 30+ days before the event: 75% refund of deposit. Cancellations made 15-29 days before: 50% refund. Cancellations made less than 15 days before: No refund.

4. VENUE RESPONSIBILITIES
   Veloria Grand shall provide the venue, basic utilities, parking facilities, and standard event support staff as agreed.

5. CLIENT RESPONSIBILITIES
   The Client is responsible for guest management, adherence to venue capacity limits, and compliance with all applicable laws and regulations.

6. GOVERNING LAW
   This Agreement shall be governed by the laws of Maharashtra, India.

By signing below, both parties agree to the terms and conditions outlined in this Agreement.

Client Signature: ____________________  Date: ____________
Venue Representative: ________________  Date: ____________`,
    },
    {
      name: "Vendor Service Agreement",
      category: "Vendor",
      variables: ["vendorName", "serviceName", "eventDate", "serviceAmount", "paymentTerms"],
      content: `VENDOR SERVICE AGREEMENT

This Vendor Service Agreement ("Agreement") is entered into between Veloria Grand ("Company") and {{vendorName}} ("Vendor").

1. SERVICE DETAILS
   Service: {{serviceName}}
   Event Date: {{eventDate}}
   Service Amount: {{serviceAmount}}

2. PAYMENT TERMS
   {{paymentTerms}}

3. SERVICE STANDARDS
   The Vendor agrees to provide services meeting industry standards and Veloria Grand quality benchmarks. Any substandard service may result in partial or full withholding of payment.

4. LIABILITY
   The Vendor shall maintain appropriate insurance and shall be responsible for any damage caused by their staff or equipment during the event.

5. CANCELLATION
   Either party may cancel with 14 days written notice. Late cancellations by the Vendor will incur a penalty of 25% of the service amount.

Vendor Signature: ____________________  Date: ____________
Veloria Grand Representative: ________  Date: ____________`,
    },
    {
      name: "Cancellation & Refund Policy",
      category: "Policy",
      variables: ["clientName", "bookingId", "cancellationDate", "refundAmount"],
      content: `CANCELLATION & REFUND ACKNOWLEDGEMENT

Client: {{clientName}}
Booking Reference: {{bookingId}}
Cancellation Date: {{cancellationDate}}
Refund Amount: {{refundAmount}}

This document confirms that the above booking has been cancelled as per our cancellation policy. The refund amount specified will be processed within 7-10 business days to the original payment method.

Please note that this cancellation is final and the booking cannot be reinstated once processed.

For any queries, please contact our events team at events@veloriagrand.com.

Client Acknowledgement: ____________________  Date: ____________`,
    },
  ];

  const contractTemplates = [];
  for (const ct of contractTemplatesData) {
    const created = await prisma.contractTemplate.create({ data: ct });
    contractTemplates.push(created);
  }

  console.log(`Created ${contractTemplates.length} contract templates.\n`);

  console.log("Creating contracts...");

  const contractsData = [
    {
      title: "Booking Agreement — Sharma-Patel Wedding",
      status: "SIGNED" as const,
      templateId: contractTemplates[0].id,
      bookingId: bookings[0].id,
      contactId: contacts[0].id,
      createdById: allUsers[2].id,
      sentAt: subDays(now, 20),
      signedAt: subDays(now, 18),
      signerName: "Arun Sharma",
      signerEmail: "arun.sharma@email.com",
      content: `EVENT BOOKING AGREEMENT

This Event Booking Agreement is entered into between Veloria Grand and Arun Sharma.

Event Name: Sharma-Patel Wedding
Event Date: ${addDays(now, 5).toISOString().split("T")[0]}
Venue: Grand Ballroom
Total Amount: INR 15,00,000

Signed by: Arun Sharma
Date: ${subDays(now, 18).toISOString().split("T")[0]}`,
    },
    {
      title: "Booking Agreement — StartupX Launch",
      status: "SENT" as const,
      templateId: contractTemplates[0].id,
      bookingId: bookings[1].id,
      contactId: contacts[5].id,
      createdById: allUsers[2].id,
      sentAt: subDays(now, 10),
      content: `EVENT BOOKING AGREEMENT

This Event Booking Agreement is entered into between Veloria Grand and Sunita Joshi (StartupX).

Event Name: StartupX Product Launch
Event Date: ${addDays(now, 12).toISOString().split("T")[0]}
Venue: Garden Terrace
Total Amount: INR 7,08,000

Awaiting client signature.`,
    },
    {
      title: "Booking Agreement — Kapoor Grand Wedding",
      status: "DRAFT" as const,
      templateId: contractTemplates[0].id,
      bookingId: bookings[3].id,
      contactId: contacts[10].id,
      createdById: allUsers[3].id,
      content: `EVENT BOOKING AGREEMENT — DRAFT

This Event Booking Agreement is entered into between Veloria Grand and Sanjay Kapoor.

Event Name: Kapoor Grand Wedding
Event Date: ${addDays(now, 30).toISOString().split("T")[0]}
Venue: To be confirmed
Total Amount: INR 28,61,500

This is a draft document pending review and approval.`,
    },
  ];

  const contracts = [];
  for (const c of contractsData) {
    const created = await prisma.contract.create({ data: c });
    contracts.push(created);
  }

  console.log(`Created ${contracts.length} contracts.\n`);

  // ============================================================
  // 34. Payouts
  // ============================================================
  console.log("Creating payouts...");

  const payoutsData = [
    { amount: 180000, status: "PAID" as const, type: "VENDOR_PAYMENT" as const, vendorId: vendors[0].id, bookingId: bookings[6].id, description: "Catering — Desai Anniversary Dinner", referenceNumber: "PAY-2026-001", paidAt: subDays(now, 3) },
    { amount: 75000, status: "APPROVED" as const, type: "VENDOR_PAYMENT" as const, vendorId: vendors[1].id, bookingId: bookings[0].id, description: "Décor advance — Sharma-Patel Wedding", referenceNumber: "PAY-2026-002" },
    { amount: 50000, status: "PENDING" as const, type: "VENDOR_PAYMENT" as const, vendorId: vendors[2].id, bookingId: bookings[7].id, description: "Photography — MediaCo Awards Night" },
    { amount: 25000, status: "PAID" as const, type: "COMMISSION" as const, description: "Sales commission — Q1 2026", referenceNumber: "PAY-2026-003", paidAt: subDays(now, 10), approvedById: allUsers[1].id },
    { amount: 500000, status: "PENDING" as const, type: "OWNER_PAYOUT" as const, description: "Monthly owner payout — January 2026", notes: "Net revenue after vendor payments and operational costs" },
  ];

  const payouts = [];
  for (const p of payoutsData) {
    const created = await prisma.payout.create({ data: p });
    payouts.push(created);
  }

  console.log(`Created ${payouts.length} payouts.\n`);

  // ============================================================
  // 35. Commission Rules & Entries
  // ============================================================
  console.log("Creating commission rules...");

  const commissionRulesData = [
    { name: "Sales Executive — Standard Commission", role: "SALES_EXEC", percentage: 5, isActive: true },
    { name: "Event Coordinator — Booking Bonus", role: "EVENT_COORDINATOR", percentage: 2, isActive: true },
    { name: "Premium Booking Bonus", bookingType: "Wedding", percentage: 3, flatAmount: 5000, isActive: true },
  ];

  const commissionRules = [];
  for (const cr of commissionRulesData) {
    const created = await prisma.commissionRule.create({ data: cr });
    commissionRules.push(created);
  }

  console.log(`Created ${commissionRules.length} commission rules.\n`);

  console.log("Creating commission entries...");

  const commissionEntriesData = [
    { ruleId: commissionRules[0].id, userId: allUsers[2].id, bookingId: bookings[0].id, invoiceAmount: 1500000, commissionAmount: 75000, status: "PAID" as const, paidAt: subDays(now, 5) },
    { ruleId: commissionRules[0].id, userId: allUsers[3].id, bookingId: bookings[7].id, invoiceAmount: 1800000, commissionAmount: 90000, status: "APPROVED" as const },
    { ruleId: commissionRules[1].id, userId: allUsers[4].id, bookingId: bookings[0].id, invoiceAmount: 1500000, commissionAmount: 30000, status: "PENDING" as const },
    { ruleId: commissionRules[2].id, userId: allUsers[2].id, bookingId: bookings[3].id, invoiceAmount: 2500000, commissionAmount: 80000, status: "PENDING" as const },
  ];

  const commissionEntries = [];
  for (const ce of commissionEntriesData) {
    const created = await prisma.commissionEntry.create({ data: ce });
    commissionEntries.push(created);
  }

  console.log(`Created ${commissionEntries.length} commission entries.\n`);

  // ============================================================
  // 36. Insurance Policies
  // ============================================================
  console.log("Creating insurance policies...");

  const insurancePoliciesData = [
    { provider: "ICICI Lombard", policyNumber: "EL-2026-VG-001", type: "EVENT_LIABILITY" as const, coverageAmount: 5000000, premium: 45000, startDate: startOfMonth(now), endDate: addMonths(startOfMonth(now), 12), status: "ACTIVE" as const, venueId: venues[0].id },
    { provider: "HDFC Ergo", policyNumber: "PR-2026-VG-002", type: "PROPERTY" as const, coverageAmount: 25000000, premium: 120000, startDate: startOfMonth(now), endDate: addMonths(startOfMonth(now), 12), status: "ACTIVE" as const, venueId: venues[0].id },
    { provider: "Bajaj Allianz", policyNumber: "CN-2026-VG-003", type: "CANCELLATION" as const, coverageAmount: 2000000, premium: 35000, startDate: subDays(now, 10), endDate: addDays(now, 10), status: "ACTIVE" as const, bookingId: bookings[0].id },
    { provider: "New India Assurance", policyNumber: "WE-2025-VG-004", type: "WEATHER" as const, coverageAmount: 1000000, premium: 25000, startDate: subMonths(now, 14), endDate: subMonths(now, 2), status: "EXPIRED" as const, venueId: venues[1].id },
  ];

  const insurancePolicies = [];
  for (const ip of insurancePoliciesData) {
    const created = await prisma.insurancePolicy.create({ data: ip });
    insurancePolicies.push(created);
  }

  console.log(`Created ${insurancePolicies.length} insurance policies.\n`);

  // ============================================================
  // 37. Resources & Allocations
  // ============================================================
  console.log("Creating resources...");

  const resourcesData = [
    { name: "Main Stage (20x30 ft)", type: "EQUIPMENT" as const, hourlyRate: 5000 },
    { name: "LED Wall (16x9 ft)", type: "EQUIPMENT" as const, hourlyRate: 8000 },
    { name: "Generator (125 KVA)", type: "EQUIPMENT" as const, hourlyRate: 3000 },
    { name: "Luxury Tempo Traveller", type: "VEHICLE" as const, hourlyRate: 2500 },
    { name: "Mini Bus (35 seater)", type: "VEHICLE" as const, hourlyRate: 4000 },
    { name: "Event Coordinator (Freelance)", type: "STAFF" as const, hourlyRate: 1500 },
    { name: "Outdoor Heater Unit", type: "VENUE_ADDON" as const, hourlyRate: 1000 },
    { name: "VIP Lounge Setup", type: "VENUE_ADDON" as const, hourlyRate: 6000 },
  ];

  const resources = [];
  for (const r of resourcesData) {
    const created = await prisma.resource.create({ data: r });
    resources.push(created);
  }

  console.log(`Created ${resources.length} resources.\n`);

  console.log("Creating resource allocations...");

  const resourceAllocationsData = [
    { resourceId: resources[0].id, date: bookings[0].date, startTime: "14:00", endTime: "23:00", bookingId: bookings[0].id },
    { resourceId: resources[1].id, date: bookings[7].date, startTime: "16:00", endTime: "23:00", bookingId: bookings[7].id },
    { resourceId: resources[3].id, date: bookings[0].date, startTime: "10:00", endTime: "23:00", bookingId: bookings[0].id, notes: "Guest pickup from hotel" },
    { resourceId: resources[7].id, date: bookings[7].date, startTime: "17:00", endTime: "23:00", bookingId: bookings[7].id },
  ];

  const resourceAllocations = [];
  for (const ra of resourceAllocationsData) {
    const created = await prisma.resourceAllocation.create({ data: ra });
    resourceAllocations.push(created);
  }

  console.log(`Created ${resourceAllocations.length} resource allocations.\n`);

  // ============================================================
  // 38. Staff Profiles, Shifts & Payroll
  // ============================================================
  console.log("Creating staff profiles...");

  const staffProfilesData = [
    {
      userId: allUsers[4].id,
      department: "Events",
      designation: "Senior Event Coordinator",
      hourlyRate: 500,
      monthlyRate: 65000,
      emergencyContact: { name: "Meera Singh", phone: "+91 98765 11111", relationship: "Spouse" },
    },
    {
      userId: allUsers[6].id,
      department: "Operations",
      designation: "Operations Executive",
      hourlyRate: 350,
      monthlyRate: 45000,
      emergencyContact: { name: "Rekha Verma", phone: "+91 98765 22222", relationship: "Mother" },
    },
    {
      userId: allUsers[5].id,
      department: "Finance",
      designation: "Finance Manager",
      hourlyRate: 600,
      monthlyRate: 80000,
    },
  ];

  const staffProfiles = [];
  for (const sp of staffProfilesData) {
    const created = await prisma.staffProfile.create({ data: sp });
    staffProfiles.push(created);
  }

  console.log(`Created ${staffProfiles.length} staff profiles.\n`);

  console.log("Creating shifts...");

  const shiftsData = [
    { staffId: staffProfiles[0].id, date: addDays(now, 5), startTime: "08:00", endTime: "22:00", role: "Lead Coordinator", status: "SCHEDULED" as const, bookingId: bookings[0].id },
    { staffId: staffProfiles[0].id, date: addDays(now, 20), startTime: "16:00", endTime: "23:00", role: "Event Coordinator", status: "SCHEDULED" as const, bookingId: bookings[7].id },
    { staffId: staffProfiles[1].id, date: addDays(now, 5), startTime: "06:00", endTime: "23:00", role: "Operations Support", status: "SCHEDULED" as const, bookingId: bookings[0].id },
    { staffId: staffProfiles[1].id, date: subDays(now, 5), startTime: "10:00", endTime: "22:00", role: "Operations Support", status: "COMPLETED" as const, hoursWorked: 12, overtimeHours: 4, bookingId: bookings[6].id },
    { staffId: staffProfiles[0].id, date: subDays(now, 5), startTime: "14:00", endTime: "22:00", role: "Event Coordinator", status: "COMPLETED" as const, hoursWorked: 8, bookingId: bookings[6].id },
    { staffId: staffProfiles[1].id, date: addDays(now, 1), startTime: "08:00", endTime: "23:00", role: "Setup Crew Lead", status: "SCHEDULED" as const, bookingId: bookings[2].id },
  ];

  const shifts = [];
  for (const s of shiftsData) {
    const created = await prisma.shift.create({ data: s });
    shifts.push(created);
  }

  console.log(`Created ${shifts.length} shifts.\n`);

  console.log("Creating payroll entries...");

  const payrollEntriesData = [
    { staffId: staffProfiles[0].id, month: lastMonthPeriod, basePay: 65000, overtimePay: 12000, deductions: 5000, netPay: 72000, status: "PAID" as const, paidAt: subDays(now, 5) },
    { staffId: staffProfiles[1].id, month: lastMonthPeriod, basePay: 45000, overtimePay: 8400, deductions: 3500, netPay: 49900, status: "PAID" as const, paidAt: subDays(now, 5) },
    { staffId: staffProfiles[2].id, month: lastMonthPeriod, basePay: 80000, overtimePay: 0, deductions: 6000, netPay: 74000, status: "PAID" as const, paidAt: subDays(now, 5) },
    { staffId: staffProfiles[0].id, month: twoMonthsPeriod, basePay: 65000, overtimePay: 9500, deductions: 5000, netPay: 69500, status: "PAID" as const, paidAt: subDays(now, 35) },
  ];

  const payrollEntries = [];
  for (const pe of payrollEntriesData) {
    const created = await prisma.payrollEntry.create({ data: pe });
    payrollEntries.push(created);
  }

  console.log(`Created ${payrollEntries.length} payroll entries.\n`);

  // ============================================================
  // 39. Email Templates
  // ============================================================
  console.log("Creating email templates...");

  const emailTemplatesData = [
    {
      name: "Booking Confirmation",
      subject: "Your Event Booking is Confirmed — {{eventName}}",
      category: "Booking",
      htmlContent: "<h1>Booking Confirmed!</h1><p>Dear {{clientName}},</p><p>We are delighted to confirm your booking for <strong>{{eventName}}</strong> on <strong>{{eventDate}}</strong> at <strong>{{venueName}}</strong>.</p><p>Your booking reference: <strong>{{bookingId}}</strong></p><p>Total Amount: ₹{{totalAmount}}</p><p>Please feel free to reach out if you have any questions.</p><p>Warm regards,<br/>Veloria Grand Team</p>",
    },
    {
      name: "Payment Reminder",
      subject: "Payment Reminder — {{eventName}}",
      category: "Finance",
      htmlContent: "<h1>Payment Reminder</h1><p>Dear {{clientName}},</p><p>This is a friendly reminder that your payment of <strong>₹{{amountDue}}</strong> for <strong>{{eventName}}</strong> is due on <strong>{{dueDate}}</strong>.</p><p>Please ensure timely payment to avoid any disruptions to your event planning.</p><p>Payment can be made via bank transfer, UPI, or at our office.</p><p>Warm regards,<br/>Veloria Grand Finance Team</p>",
    },
    {
      name: "Event Tomorrow Reminder",
      subject: "Tomorrow is the Big Day — {{eventName}}",
      category: "Event",
      htmlContent: "<h1>Your Event is Tomorrow!</h1><p>Dear {{clientName}},</p><p>We are excited to remind you that <strong>{{eventName}}</strong> is happening tomorrow at <strong>{{venueName}}</strong>!</p><p><strong>Event Time:</strong> {{eventTime}}</p><p><strong>Venue:</strong> {{venueName}}</p><p>Our team is ready and setup is in progress. If you have any last-minute requests, please contact your event coordinator directly.</p><p>We look forward to making your event memorable!</p><p>Best wishes,<br/>Veloria Grand Events Team</p>",
    },
    {
      name: "Post-Event Thank You",
      subject: "Thank You for Choosing Veloria Grand!",
      category: "Follow-Up",
      htmlContent: "<h1>Thank You!</h1><p>Dear {{clientName}},</p><p>Thank you for choosing Veloria Grand for <strong>{{eventName}}</strong>. It was our pleasure to be part of your special occasion.</p><p>We would love to hear your feedback! Please take a moment to share your experience by clicking the link below:</p><p><a href='{{feedbackLink}}'>Share Your Feedback</a></p><p>We hope to serve you again soon.</p><p>Warm regards,<br/>Veloria Grand Team</p>",
    },
    {
      name: "Quote Proposal",
      subject: "Your Event Proposal — {{eventName}}",
      category: "Sales",
      htmlContent: "<h1>Your Event Proposal</h1><p>Dear {{clientName}},</p><p>Thank you for your interest in hosting <strong>{{eventName}}</strong> at Veloria Grand.</p><p>We have prepared a customized proposal for your event. Please find the details below:</p><p><strong>Venue:</strong> {{venueName}}</p><p><strong>Date:</strong> {{eventDate}}</p><p><strong>Estimated Amount:</strong> ₹{{totalAmount}}</p><p>This proposal is valid until <strong>{{validUntil}}</strong>.</p><p>Please review the attached document for the complete breakdown. We are happy to discuss any customizations.</p><p>Best regards,<br/>Veloria Grand Sales Team</p>",
    },
  ];

  const emailTemplates = [];
  for (const et of emailTemplatesData) {
    const created = await prisma.emailTemplate.create({ data: et });
    emailTemplates.push(created);
  }

  console.log(`Created ${emailTemplates.length} email templates.\n`);

  // ============================================================
  // 40. Campaigns
  // ============================================================
  console.log("Creating campaigns...");

  const campaignsData = [
    {
      name: "Wedding Season 2026 — Early Bird Offers",
      subject: "Book Your Dream Wedding & Save 15%!",
      status: "SENT" as const,
      sentAt: subDays(now, 20),
      totalSent: 450,
      totalOpened: 180,
      totalClicked: 65,
      htmlContent: "<h1>Wedding Season 2026</h1><p>Book your dream wedding at Veloria Grand and enjoy a flat 15% early bird discount on all wedding packages. Limited period offer!</p><p>Contact us today to schedule a venue visit.</p>",
      createdById: allUsers[2].id,
    },
    {
      name: "Corporate Event Solutions",
      subject: "Elevate Your Next Corporate Event with Veloria Grand",
      status: "SCHEDULED" as const,
      scheduledAt: addDays(now, 7),
      htmlContent: "<h1>Corporate Event Solutions</h1><p>From conferences to award nights, Veloria Grand offers world-class corporate event solutions. State-of-the-art AV, gourmet catering, and dedicated event coordination.</p><p>Request a proposal today!</p>",
      createdById: allUsers[2].id,
    },
    {
      name: "Monsoon Special — Garden Terrace",
      subject: "Exclusive Monsoon Packages at Garden Terrace",
      status: "DRAFT" as const,
      htmlContent: "<h1>Monsoon Magic at Garden Terrace</h1><p>Experience the beauty of monsoon at our Garden Terrace with special rain-themed packages. Transparent canopies, fairy lights, and gourmet hot beverage counters included!</p>",
      createdById: allUsers[3].id,
    },
  ];

  const campaigns = [];
  for (const camp of campaignsData) {
    const created = await prisma.campaign.create({ data: camp });
    campaigns.push(created);
  }

  console.log(`Created ${campaigns.length} campaigns.\n`);

  // ============================================================
  // 41. Communications & WhatsApp Messages
  // ============================================================
  console.log("Creating communications...");

  const communicationsData = [
    { type: "CALL" as const, subject: "Initial consultation call", content: "Discussed wedding requirements, preferred dates, estimated guest count of 400, and budget range. Client very interested in Grand Ballroom.", direction: "OUTBOUND" as const, contactId: contacts[0].id, bookingId: bookings[0].id, createdById: allUsers[2].id, createdAt: subDays(now, 25) },
    { type: "EMAIL" as const, subject: "Venue options shared", content: "Sent venue brochure with pricing for Garden Terrace and Crystal Banquet Hall. Included virtual tour links and availability calendar.", direction: "OUTBOUND" as const, contactId: contacts[5].id, createdById: allUsers[2].id, createdAt: subDays(now, 20) },
    { type: "NOTE" as const, content: "Client prefers outdoor ceremony with indoor reception as backup. Wants traditional mandap setup with modern lighting. Budget flexible for premium décor.", direction: "OUTBOUND" as const, contactId: contacts[10].id, bookingId: bookings[3].id, createdById: allUsers[3].id, createdAt: subDays(now, 15) },
    { type: "MEETING" as const, subject: "Venue site visit", content: "Conducted Grand Ballroom walkthrough with the Tiwari family. They were impressed with the chandeliers and stage area. Discussed catering options and parking logistics.", direction: "OUTBOUND" as const, contactId: contacts[8].id, createdById: allUsers[4].id, createdAt: subDays(now, 12) },
    { type: "WHATSAPP" as const, content: "Sent booking confirmation and payment receipt to Arun Sharma. Shared event coordinator contact details for day-of coordination.", direction: "OUTBOUND" as const, contactId: contacts[0].id, bookingId: bookings[0].id, createdById: allUsers[4].id, createdAt: subDays(now, 8) },
  ];

  const communications = [];
  for (const comm of communicationsData) {
    const created = await prisma.communication.create({ data: comm });
    communications.push(created);
  }

  console.log(`Created ${communications.length} communications.\n`);

  console.log("Creating WhatsApp messages...");

  const whatsappMessagesData = [
    { content: "Dear Arun, your booking for Sharma-Patel Wedding at Grand Ballroom is confirmed! Booking Ref: BK-001. Event date: " + addDays(now, 5).toISOString().split("T")[0] + ". For any queries, contact your event coordinator.", direction: "OUTBOUND" as const, status: "DELIVERED" as const, templateName: "booking_confirmation", contactId: contacts[0].id, sentAt: subDays(now, 18) },
    { content: "Hi Sunita, thank you for choosing Veloria Grand for the StartupX Product Launch. We are excited to host your event at the Garden Terrace. Our team will be in touch shortly with the setup details.", direction: "OUTBOUND" as const, status: "READ" as const, contactId: contacts[5].id, sentAt: subDays(now, 15) },
    { content: "Reminder: Sharma-Patel Wedding is in 5 days. Please confirm final guest count and any last-minute arrangements. Contact your coordinator at events@veloriagrand.com.", direction: "OUTBOUND" as const, status: "SENT" as const, templateName: "event_tomorrow_reminder", contactId: contacts[0].id },
    { content: "Thank you for the wonderful event experience! The anniversary celebration was beautifully organized. Will definitely recommend Veloria Grand to friends and family.", direction: "INBOUND" as const, status: "DELIVERED" as const, contactId: contacts[9].id, sentAt: subDays(now, 4) },
  ];

  const whatsappMessages = [];
  for (const wm of whatsappMessagesData) {
    const created = await prisma.whatsAppMessage.create({ data: wm });
    whatsappMessages.push(created);
  }

  console.log(`Created ${whatsappMessages.length} WhatsApp messages.\n`);

  // ============================================================
  // 42. Loyalty Accounts & Transactions
  // ============================================================
  console.log("Creating loyalty accounts...");

  const loyaltyAccountsData = [
    { contactId: contacts[0].id, points: 2500, tier: "GOLD" as const, totalEarned: 3000, totalRedeemed: 500 },
    { contactId: contacts[5].id, points: 1200, tier: "SILVER" as const, totalEarned: 1200, totalRedeemed: 0 },
    { contactId: contacts[9].id, points: 800, tier: "BRONZE" as const, totalEarned: 800, totalRedeemed: 0 },
    { contactId: contacts[10].id, points: 5000, tier: "PLATINUM" as const, totalEarned: 6500, totalRedeemed: 1500 },
  ];

  const loyaltyAccounts = [];
  for (const la of loyaltyAccountsData) {
    const created = await prisma.loyaltyAccount.create({ data: la });
    loyaltyAccounts.push(created);
  }

  console.log(`Created ${loyaltyAccounts.length} loyalty accounts.\n`);

  console.log("Creating loyalty transactions...");

  const loyaltyTransactionsData = [
    { accountId: loyaltyAccounts[0].id, type: "EARNED" as const, points: 1500, description: "Booking — Sharma-Patel Wedding", referenceId: bookings[0].id },
    { accountId: loyaltyAccounts[0].id, type: "EARNED" as const, points: 1500, description: "Referral bonus — referred Kapoor family" },
    { accountId: loyaltyAccounts[0].id, type: "REDEEMED" as const, points: -500, description: "Redeemed for décor upgrade" },
    { accountId: loyaltyAccounts[1].id, type: "EARNED" as const, points: 1200, description: "Booking — StartupX Launch", referenceId: bookings[1].id },
    { accountId: loyaltyAccounts[2].id, type: "EARNED" as const, points: 800, description: "Booking — Mehta Birthday", referenceId: bookings[2].id },
    { accountId: loyaltyAccounts[3].id, type: "EARNED" as const, points: 3000, description: "Booking — Kapoor Wedding deposit", referenceId: bookings[3].id },
    { accountId: loyaltyAccounts[3].id, type: "EARNED" as const, points: 3500, description: "Loyalty tier bonus — Platinum upgrade" },
    { accountId: loyaltyAccounts[3].id, type: "REDEEMED" as const, points: -1500, description: "Redeemed for VIP lounge upgrade" },
  ];

  const loyaltyTransactions = [];
  for (const lt of loyaltyTransactionsData) {
    const created = await prisma.loyaltyTransaction.create({ data: lt });
    loyaltyTransactions.push(created);
  }

  console.log(`Created ${loyaltyTransactions.length} loyalty transactions.\n`);

  // ============================================================
  // 43. Forecasts
  // ============================================================
  console.log("Creating forecast entries...");

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const forecastsData = [
    { month: String(currentMonth + 1).padStart(2, "0"), year: currentYear, predictedRevenue: 4500000, predictedBookings: 8, confidence: 85 },
    { month: String(((currentMonth + 1) % 12) + 1).padStart(2, "0"), year: currentMonth + 1 >= 12 ? currentYear + 1 : currentYear, predictedRevenue: 5200000, predictedBookings: 10, confidence: 78 },
    { month: String(((currentMonth + 2) % 12) + 1).padStart(2, "0"), year: currentMonth + 2 >= 12 ? currentYear + 1 : currentYear, predictedRevenue: 6800000, predictedBookings: 14, confidence: 70 },
    { month: String(((currentMonth + 3) % 12) + 1).padStart(2, "0"), year: currentMonth + 3 >= 12 ? currentYear + 1 : currentYear, predictedRevenue: 7200000, predictedBookings: 15, confidence: 62 },
    { month: String(((currentMonth + 4) % 12) + 1).padStart(2, "0"), year: currentMonth + 4 >= 12 ? currentYear + 1 : currentYear, predictedRevenue: 5500000, predictedBookings: 11, confidence: 55 },
    { month: String(((currentMonth + 5) % 12) + 1).padStart(2, "0"), year: currentMonth + 5 >= 12 ? currentYear + 1 : currentYear, predictedRevenue: 4800000, predictedBookings: 9, confidence: 48 },
  ];

  const forecasts = [];
  for (const f of forecastsData) {
    const created = await prisma.forecastEntry.create({ data: f });
    forecasts.push(created);
  }

  console.log(`Created ${forecasts.length} forecast entries.\n`);

  // ============================================================
  // 44. Budgets
  // ============================================================
  console.log("Creating budgets...");

  const budgetMonth = String(now.getMonth() + 1).padStart(2, "0");
  const budgetYear = now.getFullYear();

  const budgetsData = [
    { name: "Grand Ballroom — Operations", venueId: venues[0].id, month: budgetMonth, year: budgetYear, revenue: 3500000, expenses: 1800000, profit: 1700000, category: "Venue Operations" },
    { name: "Garden Terrace — Operations", venueId: venues[1].id, month: budgetMonth, year: budgetYear, revenue: 1200000, expenses: 650000, profit: 550000, category: "Venue Operations" },
    { name: "Marketing & Sales", month: budgetMonth, year: budgetYear, revenue: 0, expenses: 350000, profit: -350000, category: "Marketing", notes: "Q1 campaign spend including digital ads, print materials, and wedding fair participation" },
    { name: "Staff & Admin", month: budgetMonth, year: budgetYear, revenue: 0, expenses: 800000, profit: -800000, category: "HR & Admin" },
  ];

  const budgets = [];
  for (const b of budgetsData) {
    const created = await prisma.budget.create({ data: b });
    budgets.push(created);
  }

  console.log(`Created ${budgets.length} budgets.\n`);

  // ============================================================
  // 45. Competitors
  // ============================================================
  console.log("Creating competitors...");

  const competitorsData = [
    { name: "The Grand Palace Events", website: "https://grandpalaceevents.com", location: "Mumbai", venueTypes: ["Banquet Hall", "Lawn", "Rooftop"], priceRange: "₹3L - ₹25L", rating: 4, strengths: "Large venue capacity, established brand, good catering", weaknesses: "Dated décor, limited parking, slow response times" },
    { name: "Royal Heritage Venues", location: "Mumbai", venueTypes: ["Heritage Property", "Courtyard"], priceRange: "₹5L - ₹30L", rating: 4, strengths: "Unique heritage architecture, excellent photography backdrops", weaknesses: "Limited availability, no AC in some areas, higher pricing" },
    { name: "Celebration Square", website: "https://celebrationsquare.in", location: "Pune", venueTypes: ["Convention Centre", "Banquet Hall", "Garden"], priceRange: "₹2L - ₹15L", rating: 3, strengths: "Affordable pricing, multiple venue options", weaknesses: "Average food quality, basic décor options" },
    { name: "Sky High Events", location: "Mumbai", venueTypes: ["Rooftop", "Lounge"], priceRange: "₹2L - ₹12L", rating: 4, strengths: "Stunning city views, modern ambiance, cocktail events", weaknesses: "Weather dependent, limited capacity, noise restrictions" },
    { name: "Eden Garden Resort", website: "https://edengarden.co.in", location: "Lonavala", venueTypes: ["Resort", "Lawn", "Pool Side"], priceRange: "₹4L - ₹20L", rating: 4, strengths: "Destination venue, accommodation available, beautiful natural setting", weaknesses: "Far from city, limited vendor options, accessibility issues" },
  ];

  const competitors = [];
  for (const comp of competitorsData) {
    const created = await prisma.competitor.create({ data: comp });
    competitors.push(created);
  }

  console.log(`Created ${competitors.length} competitors.\n`);

  // ============================================================
  // 46. Surveys & Responses
  // ============================================================
  console.log("Creating surveys...");

  const survey1 = await prisma.survey.create({
    data: {
      title: "Post-Event Feedback Survey",
      description: "Help us improve by sharing your event experience feedback.",
      isActive: true,
      questions: {
        create: [
          { question: "How would you rate your overall experience?", type: "RATING", isRequired: true, order: 1 },
          { question: "How likely are you to recommend Veloria Grand?", type: "NPS", isRequired: true, order: 2 },
          { question: "What did you enjoy most about your event?", type: "MULTIPLE_CHOICE", options: ["Venue & Ambiance", "Food & Catering", "Staff & Service", "Décor & Setup", "Entertainment"], isRequired: true, order: 3 },
          { question: "Any suggestions for improvement?", type: "TEXT", isRequired: false, order: 4 },
        ],
      },
    },
    include: { questions: true },
  });

  const survey2 = await prisma.survey.create({
    data: {
      title: "Venue Visit Feedback",
      description: "Share your experience from your recent venue visit.",
      isActive: true,
      questions: {
        create: [
          { question: "How would you rate the venue facilities?", type: "RATING", isRequired: true, order: 1 },
          { question: "Were our staff helpful during your visit?", type: "RATING", isRequired: true, order: 2 },
          { question: "Which venue(s) interested you?", type: "MULTIPLE_CHOICE", options: ["Grand Ballroom", "Garden Terrace", "Crystal Banquet Hall", "Rooftop Sky Lounge", "Other"], isRequired: false, order: 3 },
        ],
      },
    },
    include: { questions: true },
  });

  const surveys = [survey1, survey2];

  console.log(`Created ${surveys.length} surveys.\n`);

  console.log("Creating survey responses...");

  const surveyResponse1 = await prisma.surveyResponse.create({
    data: {
      surveyId: survey1.id,
      overallRating: 5,
      npsScore: 9,
      bookingId: bookings[6].id,
      contactId: contacts[9].id,
      answers: {
        create: [
          { questionId: survey1.questions[0].id, value: "5" },
          { questionId: survey1.questions[1].id, value: "9" },
          { questionId: survey1.questions[2].id, value: "Venue & Ambiance" },
          { questionId: survey1.questions[3].id, value: "Everything was perfect!" },
        ],
      },
    },
  });

  const surveyResponse2 = await prisma.surveyResponse.create({
    data: {
      surveyId: survey1.id,
      overallRating: 4,
      npsScore: 8,
      bookingId: bookings[0].id,
      contactId: contacts[0].id,
      answers: {
        create: [
          { questionId: survey1.questions[0].id, value: "4" },
          { questionId: survey1.questions[1].id, value: "8" },
          { questionId: survey1.questions[2].id, value: "Food & Catering" },
          { questionId: survey1.questions[3].id, value: "Parking could be better organized" },
        ],
      },
    },
  });

  const surveyResponse3 = await prisma.surveyResponse.create({
    data: {
      surveyId: survey1.id,
      overallRating: 3,
      npsScore: 6,
      contactId: contacts[12].id,
      answers: {
        create: [
          { questionId: survey1.questions[0].id, value: "3" },
          { questionId: survey1.questions[1].id, value: "6" },
          { questionId: survey1.questions[2].id, value: "Staff & Service" },
          { questionId: survey1.questions[3].id, value: "Response time could be improved" },
        ],
      },
    },
  });

  const surveyResponses = [surveyResponse1, surveyResponse2, surveyResponse3];

  console.log(`Created ${surveyResponses.length} survey responses.\n`);

  // ============================================================
  // 47. Reviews
  // ============================================================
  console.log("Creating reviews...");

  const reviewsData = [
    { rating: 5, title: "Unforgettable Anniversary Celebration!", content: "Veloria Grand exceeded our expectations in every way. The Grand Ballroom was beautifully decorated, the food was exceptional, and the staff went above and beyond to make our 25th anniversary truly special.", isPublic: true, isApproved: true, contactId: contacts[9].id, bookingId: bookings[6].id, response: "Thank you so much, Pooja! It was our absolute pleasure to be part of your milestone celebration. We look forward to hosting many more special occasions for you and your family.", respondedAt: subDays(now, 3) },
    { rating: 5, title: "Perfect Wedding Venue!", content: "From the first site visit to the big day, the Veloria Grand team was professional, responsive, and genuinely caring. The Grand Ballroom looked stunning and our guests were amazed.", isPublic: true, isApproved: true, contactId: contacts[0].id, bookingId: bookings[0].id },
    { rating: 4, title: "Great Corporate Event Experience", content: "Hosted our annual conference at the Garden Terrace. The AV setup was excellent, catering was top-notch, and the team handled everything seamlessly. Minor delay in registration desk setup, but overall a fantastic experience.", isPublic: true, isApproved: true, contactId: contacts[5].id, bookingId: bookings[1].id, response: "Thank you for choosing us, Sunita! We appreciate your feedback about the registration setup and have already improved our processes. Looking forward to hosting your next event!", respondedAt: subDays(now, 1) },
    { rating: 3, title: "Good but Room for Improvement", content: "The venue was beautiful but catering was delayed by 30 minutes and the sound system had issues during the first hour. Staff was apologetic and resolved the issues eventually.", isPublic: false, isApproved: false, contactId: contacts[12].id, bookingId: bookings[4].id },
    { rating: 5, title: "Best Birthday Party Ever!", content: "My daughter's birthday was magical thanks to the Veloria Grand team. The décor was exactly what we envisioned, the food was delicious, and the kids had a blast. The entertainment arrangements were perfect!", isPublic: true, isApproved: true, contactId: contacts[9].id, bookingId: bookings[2].id, createdAt: subDays(now, 2) },
  ];

  const reviews = [];
  for (const rev of reviewsData) {
    const created = await prisma.review.create({ data: rev });
    reviews.push(created);
  }

  console.log(`Created ${reviews.length} reviews.\n`);

  // ============================================================
  // 48. Widget Inquiries
  // ============================================================
  console.log("Creating widget inquiries...");

  const widgetInquiriesData = [
    { name: "Priya Menon", email: "priya.menon@gmail.com", phone: "+91 98765 55501", eventType: "Wedding", eventDate: addDays(now, 90), guestCount: 300, venueId: venues[0].id, message: "Looking for a grand wedding venue for approximately 300 guests. Interested in the Grand Ballroom. Please share available dates and pricing.", isProcessed: false },
    { name: "Rahul Saxena", email: "rahul.s@corporate.com", phone: "+91 98765 55502", eventType: "Corporate Event", eventDate: addDays(now, 60), guestCount: 150, message: "Need a venue for our annual meeting and team-building event. Prefer a venue with good AV facilities and breakout rooms. Budget around 5-7 lakhs.", isProcessed: false },
    { name: "Ananya Krishnan", email: "ananya.k@email.com", eventType: "Engagement", guestCount: 80, message: "Small intimate engagement ceremony for around 80 guests. Looking for a beautiful garden or terrace setting. Flexible on dates.", isProcessed: true, createdAt: subDays(now, 7) },
    { name: "Mohammed Farooq", email: "farooq@email.com", phone: "+91 98765 55504", eventType: "Birthday Party", eventDate: addDays(now, 21), guestCount: 50, venueId: venues[6].id, message: "50th birthday celebration for my father. Need a cozy venue for about 50 guests with good food and décor options.", isProcessed: false },
    { name: "Sneha Patil", email: "sneha.p@email.com", eventType: "Baby Shower", guestCount: 40, message: "Planning a baby shower for about 40 guests. Looking for a pretty venue with pastel décor options and light catering.", isProcessed: true, createdAt: subDays(now, 14) },
  ];

  const widgetInquiries = [];
  for (const wi of widgetInquiriesData) {
    const created = await prisma.widgetInquiry.create({ data: wi });
    widgetInquiries.push(created);
  }

  console.log(`Created ${widgetInquiries.length} widget inquiries.\n`);

  // ============================================================
  // 49. Documents
  // ============================================================
  console.log("Creating documents...");

  const documentsData = [
    { name: "Fire Safety Certificate", fileName: "fire-safety-cert-2026.pdf", mimeType: "application/pdf", size: 245000, category: "LICENSE", venueId: venues[0].id, uploadedById: allUsers[1].id, tags: ["safety", "compliance", "fire"] },
    { name: "FSSAI Food License", fileName: "fssai-license.pdf", mimeType: "application/pdf", size: 180000, category: "LICENSE", venueId: venues[0].id, uploadedById: allUsers[1].id, tags: ["food", "compliance"] },
    { name: "Sharma Wedding — Signed Contract", fileName: "sharma-wedding-contract-signed.pdf", mimeType: "application/pdf", size: 350000, category: "CONTRACT", bookingId: bookings[0].id, contactId: contacts[0].id, uploadedById: allUsers[2].id, tags: ["contract", "signed"] },
    { name: "Vendor Agreement — Royal Caterers", fileName: "royal-caterers-agreement.pdf", mimeType: "application/pdf", size: 220000, category: "CONTRACT", uploadedById: allUsers[1].id, tags: ["vendor", "catering"] },
    { name: "Insurance Policy — Grand Ballroom", fileName: "insurance-policy-ballroom.pdf", mimeType: "application/pdf", size: 410000, category: "INSURANCE", venueId: venues[0].id, uploadedById: allUsers[5].id, tags: ["insurance", "venue"] },
    { name: "Event Photos — Desai Anniversary", fileName: "desai-anniversary-photos.zip", mimeType: "application/zip", size: 52428800, category: "PHOTO", bookingId: bookings[6].id, uploadedById: allUsers[4].id, tags: ["photos", "event"], isPublic: false },
  ];

  const documents = [];
  for (const doc of documentsData) {
    const created = await prisma.document.create({ data: doc });
    documents.push(created);
  }

  console.log(`Created ${documents.length} documents.\n`);

  // ============================================================
  // 50. Gallery Items
  // ============================================================
  console.log("Creating gallery items...");

  const galleryItemsData = [
    { title: "Grand Ballroom — Wedding Setup", description: "Elegant wedding reception setup with crystal chandeliers and floral arrangements", mediaType: "PHOTO", url: "/gallery/grand-ballroom-wedding.jpg", thumbnailUrl: "/gallery/thumbs/grand-ballroom-wedding.jpg", tags: ["wedding", "grand ballroom", "décor"], isPublic: true, venueId: venues[0].id, uploadedById: allUsers[4].id, order: 1 },
    { title: "Garden Terrace — Evening Ambiance", mediaType: "PHOTO", url: "/gallery/garden-terrace-evening.jpg", thumbnailUrl: "/gallery/thumbs/garden-terrace-evening.jpg", tags: ["outdoor", "garden terrace", "evening"], isPublic: true, venueId: venues[1].id, uploadedById: allUsers[4].id, order: 2 },
    { title: "Crystal Banquet Hall — Gala Setup", mediaType: "PHOTO", url: "/gallery/crystal-hall-gala.jpg", thumbnailUrl: "/gallery/thumbs/crystal-hall-gala.jpg", tags: ["gala", "crystal hall"], isPublic: true, venueId: venues[2].id, uploadedById: allUsers[4].id, order: 3 },
    { title: "Desai Anniversary Celebration", description: "Highlights from the Desai 25th Anniversary dinner", mediaType: "PHOTO", url: "/gallery/desai-anniversary.jpg", tags: ["anniversary", "event"], isPublic: false, bookingId: bookings[6].id, uploadedById: allUsers[4].id, order: 4 },
    { title: "Rooftop Sky Lounge — Sunset View", mediaType: "PHOTO", url: "/gallery/rooftop-sunset.jpg", thumbnailUrl: "/gallery/thumbs/rooftop-sunset.jpg", tags: ["rooftop", "sunset", "venue"], isPublic: true, venueId: venues[3].id, uploadedById: allUsers[4].id, order: 5 },
    { title: "Lakeview Lawn — Mandap Setup", description: "Traditional mandap setup at Lakeview Lawn", mediaType: "PHOTO", url: "/gallery/lakeview-mandap.jpg", tags: ["wedding", "mandap", "outdoor"], isPublic: true, venueId: venues[8].id, uploadedById: allUsers[4].id, order: 6 },
  ];

  const galleryItems = [];
  for (const gi of galleryItemsData) {
    const created = await prisma.galleryItem.create({ data: gi });
    galleryItems.push(created);
  }

  console.log(`Created ${galleryItems.length} gallery items.\n`);

  // ============================================================
  // Saved Views (System Presets)
  // ============================================================
  console.log("Creating saved views...");

  const savedViewsData = [
    // Lead views
    { name: "All Leads", entityType: "LEAD", filters: [], isDefault: true, isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "My Leads", entityType: "LEAD", filters: [{ field: "assignedToId", operator: "equals", value: "__CURRENT_USER__" }], isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "Uncontacted Leads", entityType: "LEAD", filters: [{ field: "status", operator: "equals", value: "NEW" }], isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "Hot Leads (Score ≥ 80)", entityType: "LEAD", filters: [{ field: "score", operator: "gte", value: "80" }], isSystem: true, isShared: true, createdById: superAdmin.id },
    // Contact views
    { name: "All Contacts", entityType: "CONTACT", filters: [], isDefault: true, isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "Active Contacts", entityType: "CONTACT", filters: [{ field: "isActive", operator: "equals", value: "true" }], isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "Corporate Contacts", entityType: "CONTACT", filters: [{ field: "type", operator: "equals", value: "CORPORATE" }], isSystem: true, isShared: true, createdById: superAdmin.id },
    // Invoice views
    { name: "All Invoices", entityType: "INVOICE", filters: [], isDefault: true, isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "Overdue Invoices", entityType: "INVOICE", filters: [{ field: "status", operator: "equals", value: "OVERDUE" }], isSystem: true, isShared: true, createdById: superAdmin.id },
    // Task views
    { name: "My Tasks", entityType: "TASK", filters: [{ field: "assignedToId", operator: "equals", value: "__CURRENT_USER__" }], isDefault: true, isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "Overdue Tasks", entityType: "TASK", filters: [{ field: "status", operator: "equals", value: "OVERDUE" }], isSystem: true, isShared: true, createdById: superAdmin.id },
    { name: "High Priority", entityType: "TASK", filters: [{ field: "priority", operator: "equals", value: "HIGH" }], isSystem: true, isShared: true, createdById: superAdmin.id },
  ];

  const savedViews = [];
  for (const sv of savedViewsData) {
    const created = await prisma.savedView.create({ data: sv });
    savedViews.push(created);
  }

  console.log(`Created ${savedViews.length} saved views.\n`);

  // ============================================================
  // Assignment Rules
  // ============================================================
  console.log("Creating assignment rules...");

  const assignmentRulesData = [
    {
      name: "Website leads to Amit",
      entityType: "LEAD",
      isActive: true,
      priority: 1,
      conditions: [{ field: "source", operator: "equals", value: "WEBSITE" }],
      assignToUserId: salesExec1.id,
      assignToTeam: [],
      assignmentMethod: "DIRECT",
    },
    {
      name: "Referral leads round-robin",
      entityType: "LEAD",
      isActive: true,
      priority: 2,
      conditions: [{ field: "source", operator: "equals", value: "REFERRAL" }],
      assignToTeam: [salesExec1.id, salesExec2.id],
      assignmentMethod: "ROUND_ROBIN",
      lastAssignedIdx: 0,
    },
    {
      name: "Social media leads to Neha",
      entityType: "LEAD",
      isActive: true,
      priority: 3,
      conditions: [{ field: "source", operator: "equals", value: "SOCIAL_MEDIA" }],
      assignToUserId: salesExec2.id,
      assignToTeam: [],
      assignmentMethod: "DIRECT",
    },
    {
      name: "High-value leads to Amit",
      entityType: "LEAD",
      isActive: false,
      priority: 0,
      conditions: [{ field: "score", operator: "gte", value: "70" }],
      assignToUserId: salesExec1.id,
      assignToTeam: [],
      assignmentMethod: "DIRECT",
    },
  ];

  const assignmentRules = [];
  for (const ar of assignmentRulesData) {
    const created = await prisma.assignmentRule.create({ data: ar });
    assignmentRules.push(created);
  }

  console.log(`Created ${assignmentRules.length} assignment rules.\n`);

  // ============================================================
  // Macros (Quick Actions)
  // ============================================================
  console.log("Creating macros...");

  const macrosData = [
    {
      name: "Send Follow-up",
      description: "Update status to Contacted, log a follow-up note, and create a follow-up task due in 3 days",
      entityType: "LEAD",
      icon: "Zap",
      color: "#6366f1",
      actions: [
        { type: "UPDATE_STATUS", config: { status: "CONTACTED" } },
        { type: "LOG_COMMUNICATION", config: { type: "NOTE", subject: "Follow-up sent", body: "Initial follow-up message sent to the lead." } },
        { type: "CREATE_TASK", config: { title: "Follow-up call", description: "Call the lead to discuss requirements", priority: "HIGH", dueDays: 3 } },
      ],
      isShared: true,
      isActive: true,
      createdById: superAdmin.id,
    },
    {
      name: "Mark as Lost",
      description: "Set lead status to Lost and log a closing note",
      entityType: "LEAD",
      icon: "XCircle",
      color: "#ef4444",
      actions: [
        { type: "UPDATE_STATUS", config: { status: "LOST" } },
        { type: "LOG_COMMUNICATION", config: { type: "NOTE", subject: "Lead marked as lost", body: "Lead has been marked as lost." } },
      ],
      isShared: true,
      isActive: true,
      createdById: superAdmin.id,
    },
    {
      name: "Schedule Meeting",
      description: "Create a high-priority meeting task and log a meeting communication",
      entityType: "LEAD",
      icon: "Calendar",
      color: "#8b5cf6",
      actions: [
        { type: "CREATE_TASK", config: { title: "Meeting with lead", description: "Scheduled meeting to discuss event requirements", priority: "HIGH", dueDays: 1 } },
        { type: "LOG_COMMUNICATION", config: { type: "MEETING", subject: "Meeting scheduled", body: "Meeting has been scheduled with the lead." } },
      ],
      isShared: true,
      isActive: true,
      createdById: superAdmin.id,
    },
    {
      name: "Quick Note",
      description: "Log a quick note on the contact record",
      entityType: "CONTACT",
      icon: "StickyNote",
      color: "#f59e0b",
      actions: [
        { type: "LOG_COMMUNICATION", config: { type: "NOTE", subject: "Quick note", body: "Note added via macro." } },
      ],
      isShared: true,
      isActive: true,
      createdById: superAdmin.id,
    },
  ];

  const macros = [];
  for (const m of macrosData) {
    const created = await prisma.macro.create({ data: m });
    macros.push(created);
  }

  console.log(`Created ${macros.length} macros.\n`);

  // ============================================================
  // TIER 2: Scoring Rule Sets + Rules
  // ============================================================
  console.log("Creating scoring rule sets...");

  const leadScoringRuleSet = await prisma.scoringRuleSet.create({
    data: {
      name: "Lead Scoring — Default",
      entityType: "LEAD",
      description: "Default scoring rules for leads based on value, engagement, and profile completeness.",
      isActive: true,
      maxScore: 100,
    },
  });

  const contactScoringRuleSet = await prisma.scoringRuleSet.create({
    data: {
      name: "Contact Engagement Score",
      entityType: "CONTACT",
      description: "Scores contacts based on interaction frequency and profile data.",
      isActive: true,
      maxScore: 100,
    },
  });

  const leadScoringRules = await Promise.all([
    prisma.scoringRule.create({
      data: {
        name: "High Estimated Value",
        category: "FIELD_BASED",
        points: 20,
        conditions: [{ field: "estimatedValue", operator: "greater_than", value: "500000" }],
        isActive: true,
        order: 1,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
    prisma.scoringRule.create({
      data: {
        name: "Medium Estimated Value",
        category: "FIELD_BASED",
        points: 10,
        conditions: [{ field: "estimatedValue", operator: "greater_than", value: "200000" }],
        isActive: true,
        order: 2,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
    prisma.scoringRule.create({
      data: {
        name: "Referral Source",
        category: "FIELD_BASED",
        points: 15,
        conditions: [{ field: "source", operator: "equals", value: "REFERRAL" }],
        isActive: true,
        order: 3,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
    prisma.scoringRule.create({
      data: {
        name: "Event Within 3 Months",
        category: "FIELD_BASED",
        points: 15,
        conditions: [{ field: "eventDate", operator: "within_days", value: "90" }],
        isActive: true,
        order: 4,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
    prisma.scoringRule.create({
      data: {
        name: "Large Guest Count (200+)",
        category: "FIELD_BASED",
        points: 10,
        conditions: [{ field: "guestCount", operator: "greater_than", value: "200" }],
        isActive: true,
        order: 5,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
    prisma.scoringRule.create({
      data: {
        name: "Has Phone Number",
        category: "PROFILE_COMPLETENESS",
        points: 5,
        conditions: [{ field: "contact.phone", operator: "is_not_empty", value: "" }],
        isActive: true,
        order: 6,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
    prisma.scoringRule.create({
      data: {
        name: "Has Description",
        category: "PROFILE_COMPLETENESS",
        points: 5,
        conditions: [{ field: "description", operator: "is_not_empty", value: "" }],
        isActive: true,
        order: 7,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
    prisma.scoringRule.create({
      data: {
        name: "Inactivity Decay (14 days)",
        category: "DECAY",
        points: -5,
        conditions: [{ field: "updatedAt", operator: "older_than_days", value: "14" }],
        isActive: true,
        order: 8,
        ruleSetId: leadScoringRuleSet.id,
      },
    }),
  ]);

  console.log(`Created ${leadScoringRules.length + 0} scoring rules in 2 rule sets.\n`);

  // ============================================================
  // TIER 2: Blueprints (Process Designer)
  // ============================================================
  console.log("Creating blueprints...");

  const leadBlueprint = await prisma.blueprint.create({
    data: {
      name: "Lead Lifecycle",
      entityType: "LEAD",
      description: "Enforces the standard lead progression: NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON/LOST",
      isActive: true,
      isPublished: true,
      createdById: superAdmin.id,
    },
  });

  const leadTransitions = await Promise.all([
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "NEW",
        toStatus: "CONTACTED",
        name: "Initial Contact",
        requiredFields: [],
        requiredActions: ["Log at least one communication"],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 1,
        blueprintId: leadBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "CONTACTED",
        toStatus: "QUALIFIED",
        name: "Qualify Lead",
        requiredFields: ["estimatedValue", "eventType"],
        requiredActions: [],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 2,
        blueprintId: leadBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "QUALIFIED",
        toStatus: "PROPOSAL_SENT",
        name: "Send Proposal",
        requiredFields: ["estimatedValue", "eventDate"],
        requiredActions: ["Create a quote"],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 3,
        blueprintId: leadBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "PROPOSAL_SENT",
        toStatus: "NEGOTIATION",
        name: "Enter Negotiation",
        requiredFields: [],
        requiredActions: [],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 4,
        blueprintId: leadBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "NEGOTIATION",
        toStatus: "WON",
        name: "Win Deal",
        requiredFields: ["estimatedValue"],
        requiredActions: ["Convert to deal"],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 5,
        blueprintId: leadBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "NEGOTIATION",
        toStatus: "LOST",
        name: "Lose Deal",
        requiredFields: ["lostReason"],
        requiredActions: [],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 6,
        blueprintId: leadBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "PROPOSAL_SENT",
        toStatus: "LOST",
        name: "Proposal Rejected",
        requiredFields: ["lostReason"],
        requiredActions: [],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 7,
        blueprintId: leadBlueprint.id,
      },
    }),
  ]);

  const bookingBlueprint = await prisma.blueprint.create({
    data: {
      name: "Booking Lifecycle",
      entityType: "BOOKING",
      description: "Enforces booking workflow: INQUIRY → TENTATIVE → CONFIRMED → IN_PROGRESS → COMPLETED/CANCELLED",
      isActive: true,
      isPublished: true,
      createdById: superAdmin.id,
    },
  });

  await Promise.all([
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "INQUIRY",
        toStatus: "TENTATIVE",
        name: "Reserve Date",
        requiredFields: ["eventDate", "venueId"],
        requiredActions: [],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC", "EVENT_COORDINATOR"],
        conditions: [],
        isActive: true,
        order: 1,
        blueprintId: bookingBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "TENTATIVE",
        toStatus: "CONFIRMED",
        name: "Confirm Booking",
        requiredFields: [],
        requiredActions: ["Collect advance payment", "Generate contract"],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"],
        conditions: [],
        isActive: true,
        order: 2,
        blueprintId: bookingBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "CONFIRMED",
        toStatus: "IN_PROGRESS",
        name: "Start Event",
        requiredFields: [],
        requiredActions: [],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "EVENT_COORDINATOR"],
        conditions: [],
        isActive: true,
        order: 3,
        blueprintId: bookingBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "IN_PROGRESS",
        toStatus: "COMPLETED",
        name: "Complete Event",
        requiredFields: [],
        requiredActions: ["Final invoice generated"],
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "EVENT_COORDINATOR"],
        conditions: [],
        isActive: true,
        order: 4,
        blueprintId: bookingBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "TENTATIVE",
        toStatus: "CANCELLED",
        name: "Cancel Tentative Booking",
        requiredFields: [],
        requiredActions: [],
        allowedRoles: ["SUPER_ADMIN", "ADMIN"],
        conditions: [],
        isActive: true,
        order: 5,
        blueprintId: bookingBlueprint.id,
      },
    }),
    prisma.blueprintTransition.create({
      data: {
        fromStatus: "CONFIRMED",
        toStatus: "CANCELLED",
        name: "Cancel Confirmed Booking",
        requiredFields: [],
        requiredActions: ["Process refund"],
        allowedRoles: ["SUPER_ADMIN", "ADMIN"],
        conditions: [],
        isActive: true,
        order: 6,
        blueprintId: bookingBlueprint.id,
      },
    }),
  ]);

  console.log(`Created 2 blueprints with ${leadTransitions.length + 6} transitions.\n`);

  // ============================================================
  // TIER 2: Sales Cadences
  // ============================================================
  console.log("Creating cadences...");

  const newLeadCadence = await prisma.cadence.create({
    data: {
      name: "New Lead Follow-Up Sequence",
      description: "7-step automated follow-up for new leads. Combines emails, tasks, and wait periods over 14 days.",
      status: "ACTIVE",
      entityType: "LEAD",
      exitCriteria: { statusChangeTo: ["WON", "LOST", "QUALIFIED"] },
      autoEnroll: false,
      autoEnrollCriteria: {},
      createdById: superAdmin.id,
    },
  });

  await Promise.all([
    prisma.cadenceStep.create({
      data: {
        stepType: "SEND_EMAIL",
        order: 0,
        config: { subject: "Welcome to Veloria Grand!", templateId: "welcome-template", body: "Thank you for your interest in Veloria Grand. We'd love to learn more about your event requirements." },
        delayDays: 0,
        delayHours: 0,
        cadenceId: newLeadCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "WAIT",
        order: 1,
        config: { reason: "Wait for response" },
        delayDays: 2,
        delayHours: 0,
        cadenceId: newLeadCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "CREATE_TASK",
        order: 2,
        config: { title: "Follow-up call with lead", description: "Call the lead to discuss their event requirements and schedule a venue visit.", priority: "HIGH" },
        delayDays: 0,
        delayHours: 0,
        cadenceId: newLeadCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "WAIT",
        order: 3,
        config: { reason: "Wait after call attempt" },
        delayDays: 3,
        delayHours: 0,
        cadenceId: newLeadCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "SEND_EMAIL",
        order: 4,
        config: { subject: "Your Dream Event at Veloria Grand", body: "Sharing our venue portfolio and recent event gallery. Would you like to schedule a visit?" },
        delayDays: 0,
        delayHours: 0,
        cadenceId: newLeadCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "WAIT",
        order: 5,
        config: { reason: "Final follow-up wait" },
        delayDays: 5,
        delayHours: 0,
        cadenceId: newLeadCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "SEND_EMAIL",
        order: 6,
        config: { subject: "Last Chance — Special Offer for Your Event", body: "We have a limited-time offer for bookings this season. Let us know if you are still interested!" },
        delayDays: 0,
        delayHours: 0,
        cadenceId: newLeadCadence.id,
      },
    }),
  ]);

  const weddingCadence = await prisma.cadence.create({
    data: {
      name: "Wedding Inquiry Nurture",
      description: "Specialized sequence for wedding inquiries with venue visit scheduling and package sharing.",
      status: "ACTIVE",
      entityType: "LEAD",
      exitCriteria: { statusChangeTo: ["WON", "LOST"] },
      autoEnroll: false,
      autoEnrollCriteria: {},
      createdById: salesExec1.id,
    },
  });

  await Promise.all([
    prisma.cadenceStep.create({
      data: {
        stepType: "SEND_EMAIL",
        order: 0,
        config: { subject: "Congratulations on Your Upcoming Wedding!", body: "We are thrilled you are considering Veloria Grand for your special day." },
        delayDays: 0,
        delayHours: 0,
        cadenceId: weddingCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "CREATE_TASK",
        order: 1,
        config: { title: "Schedule venue visit for wedding", priority: "HIGH" },
        delayDays: 1,
        delayHours: 0,
        cadenceId: weddingCadence.id,
      },
    }),
    prisma.cadenceStep.create({
      data: {
        stepType: "SEND_EMAIL",
        order: 2,
        config: { subject: "Our Wedding Packages — Tailored for You", body: "Explore our wedding packages designed to make your day unforgettable." },
        delayDays: 4,
        delayHours: 0,
        cadenceId: weddingCadence.id,
      },
    }),
  ]);

  console.log("Created 2 cadences with 10 steps.\n");

  // ============================================================
  // TIER 2: Approval Rules
  // ============================================================
  console.log("Creating approval rules...");

  const highValueDealRule = await prisma.approvalRule.create({
    data: {
      name: "High-Value Deal Approval",
      entityType: "DEAL",
      description: "Deals exceeding ₹10,00,000 require manager approval before closing.",
      isActive: true,
      priority: 1,
      conditions: [{ field: "value", operator: "greater_than", value: "1000000" }],
    },
  });

  await Promise.all([
    prisma.approvalChainStep.create({
      data: {
        order: 0,
        approverType: "USER",
        approverId: admin.id,
        isOptional: false,
        ruleId: highValueDealRule.id,
      },
    }),
    prisma.approvalChainStep.create({
      data: {
        order: 1,
        approverType: "USER",
        approverId: superAdmin.id,
        isOptional: false,
        ruleId: highValueDealRule.id,
      },
    }),
  ]);

  const discountApprovalRule = await prisma.approvalRule.create({
    data: {
      name: "Discount Approval > 20%",
      entityType: "QUOTE",
      description: "Quotes with discounts exceeding 20% require approval.",
      isActive: true,
      priority: 2,
      conditions: [{ field: "discountPercent", operator: "greater_than", value: "20" }],
    },
  });

  await prisma.approvalChainStep.create({
    data: {
      order: 0,
      approverType: "USER",
      approverId: superAdmin.id,
      isOptional: false,
      ruleId: discountApprovalRule.id,
    },
  });

  const bookingCancellationRule = await prisma.approvalRule.create({
    data: {
      name: "Booking Cancellation Approval",
      entityType: "BOOKING",
      description: "All confirmed booking cancellations require admin approval.",
      isActive: true,
      priority: 1,
      conditions: [{ field: "status", operator: "equals", value: "CONFIRMED" }],
    },
  });

  await prisma.approvalChainStep.create({
    data: {
      order: 0,
      approverType: "USER",
      approverId: superAdmin.id,
      isOptional: false,
      ruleId: bookingCancellationRule.id,
    },
  });

  console.log("Created 3 approval rules with chain steps.\n");

  // ============================================================
  // TIER 2: Webforms
  // ============================================================
  console.log("Creating webforms...");

  const eventInquiryForm = await prisma.webform.create({
    data: {
      name: "Event Inquiry Form",
      slug: "event-inquiry",
      description: "General event inquiry form for the website.",
      fields: [
        { type: "TEXT", label: "Full Name", name: "fullName", required: true, placeholder: "Enter your full name" },
        { type: "EMAIL", label: "Email Address", name: "email", required: true, placeholder: "your@email.com" },
        { type: "PHONE", label: "Phone Number", name: "phone", required: true, placeholder: "+91 98765 43210" },
        { type: "SELECT", label: "Event Type", name: "eventType", required: true, placeholder: "Select event type", options: ["Wedding", "Corporate Event", "Birthday Party", "Anniversary", "Conference", "Other"] },
        { type: "DATE", label: "Preferred Event Date", name: "eventDate", required: false, placeholder: "" },
        { type: "NUMBER", label: "Expected Guest Count", name: "guestCount", required: false, placeholder: "Approximate number of guests" },
        { type: "TEXTAREA", label: "Additional Details", name: "message", required: false, placeholder: "Tell us about your event requirements..." },
      ],
      styling: { primaryColor: "#6366f1", fontFamily: "Inter" },
      thankYouMessage: "Thank you for your inquiry! Our team will contact you within 24 hours.",
      notifyUserIds: [salesExec1.id, salesExec2.id],
      autoAssignTo: salesExec1.id,
      defaultSource: "WEBSITE",
      honeypotField: "website_url",
      isActive: true,
      createdById: superAdmin.id,
    },
  });

  const weddingInquiryForm = await prisma.webform.create({
    data: {
      name: "Wedding Inquiry Form",
      slug: "wedding-inquiry",
      description: "Specialized form for wedding inquiries with detailed questions.",
      fields: [
        { type: "TEXT", label: "Bride/Groom Name", name: "name", required: true, placeholder: "Enter your name" },
        { type: "EMAIL", label: "Email", name: "email", required: true, placeholder: "your@email.com" },
        { type: "PHONE", label: "Phone", name: "phone", required: true, placeholder: "+91 98765 43210" },
        { type: "DATE", label: "Wedding Date", name: "weddingDate", required: true, placeholder: "" },
        { type: "NUMBER", label: "Guest Count", name: "guestCount", required: true, placeholder: "Expected number of guests" },
        { type: "SELECT", label: "Budget Range", name: "budget", required: false, placeholder: "Select budget range", options: ["Under ₹5 Lakh", "₹5-10 Lakh", "₹10-25 Lakh", "₹25-50 Lakh", "Above ₹50 Lakh"] },
        { type: "TEXTAREA", label: "Special Requirements", name: "requirements", required: false, placeholder: "Decor preferences, dietary requirements, etc." },
      ],
      styling: { primaryColor: "#ec4899", fontFamily: "Inter" },
      thankYouMessage: "Thank you for considering Veloria Grand for your wedding! Our wedding specialist will reach out within 12 hours.",
      thankYouUrl: "https://veloriagrand.com/weddings/thank-you",
      notifyUserIds: [salesExec1.id, eventCoordinator.id],
      autoAssignTo: salesExec2.id,
      defaultSource: "WEBSITE",
      honeypotField: "company_website",
      isActive: true,
      createdById: superAdmin.id,
    },
  });

  console.log(`Created 2 webforms.\n`);

  // ============================================================
  // TIER 2: Email Tracking Seed (sample pixels + events)
  // ============================================================
  console.log("Creating email tracking data...");

  // We'll create tracking data for existing communications if available
  let trackingPixelsCreated = 0;
  let trackingEventsCreated = 0;

  const emailComms = await prisma.communication.findMany({
    where: { type: "EMAIL", direction: "OUTBOUND" },
    take: 5,
    include: { contact: true },
  });

  for (const comm of emailComms) {
    const pixel = await prisma.emailTrackingPixel.create({
      data: {
        communicationId: comm.id,
        contactId: comm.contactId,
        recipientEmail: comm.contact.email ?? "unknown@example.com",
      },
    });
    trackingPixelsCreated++;

    // Simulate opens (1-3 per email)
    const openCount = randomInt(1, 3);
    for (let i = 0; i < openCount; i++) {
      await prisma.emailTrackingEvent.create({
        data: {
          type: "EMAIL_OPEN",
          ipAddress: `103.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          occurredAt: new Date(comm.createdAt.getTime() + randomInt(1, 72) * 60 * 60 * 1000),
          pixelId: pixel.id,
        },
      });
      trackingEventsCreated++;
    }

    // Simulate clicks (0-2 per email)
    const clickCount = randomInt(0, 2);
    for (let i = 0; i < clickCount; i++) {
      await prisma.emailTrackingEvent.create({
        data: {
          type: "LINK_CLICK",
          ipAddress: `103.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          linkUrl: randomElement(["https://veloriagrand.com/packages", "https://veloriagrand.com/gallery", "https://veloriagrand.com/venues", "https://veloriagrand.com/contact"]),
          occurredAt: new Date(comm.createdAt.getTime() + randomInt(2, 96) * 60 * 60 * 1000),
          pixelId: pixel.id,
        },
      });
      trackingEventsCreated++;
    }
  }

  console.log(`Created ${trackingPixelsCreated} tracking pixels with ${trackingEventsCreated} events.\n`);

  // ============================================================
  // TIER 3: AI & Intelligence — Seed Data
  // ============================================================
  console.log("Seeding Tier 3: AI & Intelligence...");

  // --- AI Scoring: Update some leads with AI scores ---
  const activeLeads = await prisma.lead.findMany({
    where: { status: { notIn: ["WON", "LOST"] } },
    select: { id: true, status: true, source: true },
    take: 10,
  });

  for (const lead of activeLeads) {
    const score = randomInt(25, 90);
    const reasons = [
      score >= 70
        ? "High-priority lead with strong conversion potential."
        : score >= 40
          ? "Moderate potential. Continued nurturing recommended."
          : "Limited conversion signals at this time.",
    ];
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        aiScore: score,
        aiScoreReason: `AI Score: ${score}/100\n\n${reasons[0]}\n\nFactor Analysis:\n  - Lead source "${lead.source}" contributes well.\n  - Status "${lead.status}" indicates pipeline progression.\n  - Recent activity detected.`,
        aiScoredAt: new Date(),
      },
    });
  }
  console.log(`  Updated ${activeLeads.length} leads with AI scores.`);

  // --- AI Scoring: Update some deals with AI scores ---
  const activeDeals = await prisma.deal.findMany({
    where: { wonDate: null, lostDate: null },
    select: { id: true, title: true },
    take: 8,
  });

  for (const deal of activeDeals) {
    const score = randomInt(30, 85);
    const riskLevel = score >= 70 ? "LOW" : score >= 50 ? "MEDIUM" : score >= 30 ? "HIGH" : "CRITICAL";
    const factors = [
      { name: "Communication Engagement", impact: score > 60 ? "POSITIVE" : "NEUTRAL", score: randomInt(8, 20), description: "Recent communication activity detected." },
      { name: "Deal Value", impact: "POSITIVE", score: randomInt(5, 15), description: "Deal value within expected range." },
      { name: "Stage Velocity", impact: score > 50 ? "POSITIVE" : "NEGATIVE", score: randomInt(3, 18), description: "Pipeline progression pace." },
      { name: "Booking Status", impact: "NEUTRAL", score: randomInt(0, 15), description: "Booking conversion assessment." },
    ];
    const recommendations = [
      "Schedule a follow-up call within the next 3 days.",
      "Send a personalized proposal highlighting venue features.",
      score < 50 ? "Consider re-qualifying this deal — review client needs." : "Maintain momentum with regular check-ins.",
    ];

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        aiScore: score,
        aiScoreReason: `Win Probability: ${score}% | Risk: ${riskLevel}\n\n${recommendations[0]}\n\nFactor Breakdown:\n${factors.map((f) => `  - ${f.name}: ${f.impact} (+${f.score}pts) — ${f.description}`).join("\n")}`,
        aiScoredAt: new Date(),
        aiFactors: factors as any,
      },
    });
  }
  console.log(`  Updated ${activeDeals.length} deals with AI scores.`);

  // --- Sentiment Analysis: Update some communications with sentiment ---
  const recentComms = await prisma.communication.findMany({
    where: { sentimentAt: null },
    select: { id: true, content: true },
    take: 20,
  });

  const sentimentOptions: Array<{ sentiment: string; score: number }> = [
    { sentiment: "POSITIVE", score: 0.7 },
    { sentiment: "POSITIVE", score: 0.85 },
    { sentiment: "POSITIVE", score: 0.6 },
    { sentiment: "NEUTRAL", score: 0.1 },
    { sentiment: "NEUTRAL", score: 0.0 },
    { sentiment: "NEUTRAL", score: -0.1 },
    { sentiment: "NEGATIVE", score: -0.5 },
    { sentiment: "NEGATIVE", score: -0.65 },
  ];

  for (const comm of recentComms) {
    const opt = randomElement(sentimentOptions);
    await prisma.communication.update({
      where: { id: comm.id },
      data: {
        sentiment: opt.sentiment,
        sentimentScore: opt.score,
        sentimentAt: new Date(),
      },
    });
  }
  console.log(`  Updated ${recentComms.length} communications with sentiment data.`);

  // --- Anomaly Alerts: Create sample anomaly alerts ---
  const adminUser = allUsers.find((u) => u.role === "SUPER_ADMIN");

  const anomalyAlerts = await Promise.all([
    prisma.anomalyAlert.create({
      data: {
        type: "REVENUE_DROP",
        severity: "HIGH",
        title: "Weekly Revenue Drop Detected",
        description: "This week's invoiced revenue (₹2,45,000) is 35% below the 4-week average (₹3,77,000). This may indicate a seasonal slowdown or pipeline bottleneck. Review recent deal closures and follow up on pending proposals.",
        metric: "weekly_revenue",
        expectedValue: 377000,
        actualValue: 245000,
        deviationPercent: -35,
        isActive: true,
        detectedAt: subDays(now, 1),
      },
    }),
    prisma.anomalyAlert.create({
      data: {
        type: "BOOKING_CANCELLATION_CLUSTER",
        severity: "CRITICAL",
        title: "Booking Cancellation Cluster",
        description: "6 bookings cancelled in the last 7 days, significantly above normal (avg 1.5/week). Investigate common factors — check if pricing changes, venue issues, or competitor activity is driving cancellations.",
        metric: "weekly_cancellations",
        expectedValue: 1.5,
        actualValue: 6,
        deviationPercent: 300,
        isActive: true,
        detectedAt: subDays(now, 2),
      },
    }),
    prisma.anomalyAlert.create({
      data: {
        type: "PAYMENT_DELAY",
        severity: "HIGH",
        title: "Overdue Payments Piling Up",
        description: "5 invoices totaling ₹8,50,000 are overdue by more than 7 days. 2 invoices are overdue by 30+ days. Immediate collection action recommended to maintain cash flow.",
        metric: "overdue_amount",
        expectedValue: 0,
        actualValue: 850000,
        deviationPercent: 100,
        isActive: false,
        acknowledgedAt: subDays(now, 1),
        acknowledgedById: adminUser?.id,
        resolvedAt: subDays(now, 0.5),
        detectedAt: subDays(now, 5),
      },
    }),
    prisma.anomalyAlert.create({
      data: {
        type: "LEAD_VOLUME_CHANGE",
        severity: "MEDIUM",
        title: "Lead Volume Surge",
        description: "New leads this week (18) are 2.4x the 4-week average (7.5). This surge may be from a recent marketing campaign. Ensure adequate sales capacity to handle the increased volume.",
        metric: "weekly_leads",
        expectedValue: 7.5,
        actualValue: 18,
        deviationPercent: 140,
        isActive: true,
        detectedAt: subDays(now, 3),
      },
    }),
    prisma.anomalyAlert.create({
      data: {
        type: "CONVERSION_RATE_DROP",
        severity: "MEDIUM",
        title: "Lead Conversion Rate Declining",
        description: "This month's lead-to-deal conversion rate (12%) is 45% below the 3-month average (22%). Review lead quality and sales follow-up timing.",
        metric: "conversion_rate",
        expectedValue: 22,
        actualValue: 12,
        deviationPercent: -45,
        isActive: true,
        acknowledgedAt: subDays(now, 1),
        acknowledgedById: adminUser?.id,
        detectedAt: subDays(now, 4),
      },
    }),
  ]);

  console.log(`  Created ${anomalyAlerts.length} anomaly alerts.`);

  console.log("Tier 3 seeding complete.\n");

  // ============================================================
  // Done
  // ============================================================

  console.log("============================================");
  console.log("Seed completed successfully!");
  console.log("============================================");
  console.log("\nCreated:");
  console.log(`  - ${allUsers.length} users`);
  console.log(`  - ${stages.length} pipeline stages`);
  console.log(`  - ${venues.length} venues`);
  console.log(`  - ${contacts.length} contacts`);
  console.log(`  - ${leads.length} leads`);
  console.log(`  - ${deals.length} deals`);
  console.log(`  - ${bookings.length} bookings`);
  console.log(`  - ${taskTemplates.length} task templates`);
  console.log(`  - ${tasks.length} tasks`);
  console.log(`  - ${invoices.length} invoices`);
  console.log(`  - ${payments.length} payments`);
  console.log(`  - ${notifications.length} notifications`);
  console.log(`  - ${activityData.length} activity logs`);
  console.log(`  - ${escalationRules.length} escalation rules`);
  console.log(`  - ${vendors.length} vendors`);
  console.log(`  - ${referrals.length} referrals`);
  console.log(`  - 3 SOP templates (Wedding, Corporate, Birthday)`);
  console.log(`  - 2 execution plans (Wedding, Corporate)`);
  console.log(`  - ${referralRewardRules.length} referral reward rules`);
  console.log(`  - ${referralAssets.length} referral assets`);
  console.log(`  - ${performanceScores.length} performance scores`);
  console.log(`  - ${badges.length} badges`);
  console.log(`  - ${incentives.length} performance incentives`);
  console.log(`  - ${workflows.length} workflows`);
  console.log(`  - ${workflowLogs.length} workflow logs`);
  console.log(`  - ${emergencyProtocols.length} emergency protocols`);
  console.log(`  - ${emergencyIncidents.length} emergency incidents`);
  console.log(`  - ${eventPackages.length} event packages`);
  console.log(`  - ${menuItems.length} menu items`);
  console.log(`  - ${bookingMenus.length} booking menus`);
  console.log(`  - ${pricingRules.length} pricing rules`);
  console.log(`  - ${ratePlans.length} rate plans`);
  console.log(`  - ${inventoryItems.length} inventory items`);
  console.log(`  - ${inventoryReservations.length} inventory reservations`);
  console.log(`  - ${rentalItems.length} rental items`);
  console.log(`  - ${rentalBookings.length} rental bookings`);
  console.log(`  - ${quotes.length} quotes`);
  console.log(`  - ${contractTemplates.length} contract templates`);
  console.log(`  - ${contracts.length} contracts`);
  console.log(`  - ${payouts.length} payouts`);
  console.log(`  - ${commissionRules.length} commission rules`);
  console.log(`  - ${commissionEntries.length} commission entries`);
  console.log(`  - ${insurancePolicies.length} insurance policies`);
  console.log(`  - ${resources.length} resources`);
  console.log(`  - ${resourceAllocations.length} resource allocations`);
  console.log(`  - ${staffProfiles.length} staff profiles`);
  console.log(`  - ${shifts.length} shifts`);
  console.log(`  - ${payrollEntries.length} payroll entries`);
  console.log(`  - ${emailTemplates.length} email templates`);
  console.log(`  - ${campaigns.length} campaigns`);
  console.log(`  - ${communications.length} communications`);
  console.log(`  - ${whatsappMessages.length} WhatsApp messages`);
  console.log(`  - ${loyaltyAccounts.length} loyalty accounts`);
  console.log(`  - ${loyaltyTransactions.length} loyalty transactions`);
  console.log(`  - ${forecasts.length} forecast entries`);
  console.log(`  - ${budgets.length} budgets`);
  console.log(`  - ${competitors.length} competitors`);
  console.log(`  - ${surveys.length} surveys`);
  console.log(`  - ${surveyResponses.length} survey responses`);
  console.log(`  - ${reviews.length} reviews`);
  console.log(`  - ${widgetInquiries.length} widget inquiries`);
  console.log(`  - ${documents.length} documents`);
  console.log(`  - ${galleryItems.length} gallery items`);
  console.log(`  - ${savedViews.length} saved views (system presets)`);
  console.log(`  - ${assignmentRules.length} assignment rules`);
  console.log(`  - ${macros.length} macros (quick actions)`);
  console.log(`  - ${leadScoringRules.length} scoring rules in 2 rule sets`);
  console.log(`  - 2 blueprints (Lead + Booking lifecycle)`);
  console.log(`  - 2 cadences (10 steps total)`);
  console.log(`  - 3 approval rules with chain steps`);
  console.log(`  - 2 webforms (Event + Wedding inquiry)`);
  console.log(`  - ${trackingPixelsCreated} email tracking pixels, ${trackingEventsCreated} events`);
  console.log(`  - ${activeLeads.length} leads with AI scores`);
  console.log(`  - ${activeDeals.length} deals with AI scores`);
  console.log(`  - ${recentComms.length} communications with sentiment data`);
  console.log(`  - ${anomalyAlerts.length} anomaly alerts`);
  console.log("\nLogin credentials:");
  console.log("  Super Admin: admin@veloriagrand.com / Admin@123");
  console.log("  Admin:       ops@veloriagrand.com / Admin@123");
  console.log("  Sales 1:     sales1@veloriagrand.com / Sales@123");
  console.log("  Sales 2:     sales2@veloriagrand.com / Sales@123");
  console.log("  Events:      events@veloriagrand.com / Events@123");
  console.log("  Finance:     finance@veloriagrand.com / Finance@123");
  console.log("  Staff:       staff@veloriagrand.com / Staff@123");
  console.log("  Client:      client@example.com / Client@123");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
