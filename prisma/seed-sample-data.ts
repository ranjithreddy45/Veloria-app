/**
 * Additive sample data seed script.
 * Creates sample contacts, leads (various sources), call logs with recordings,
 * auto-welcome configs, telephony config, lead capture configs, and API keys.
 *
 * Run: pnpm db:seed-sample
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { subDays, subHours } from "date-fns";

const prisma = new PrismaClient();

// ============================================================
// Helpers
// ============================================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const now = new Date();

// ============================================================
// Sample Data
// ============================================================

const INDIAN_CONTACTS = [
  { firstName: "Aarav", lastName: "Sharma", city: "Bangalore", state: "Karnataka", company: "TechVista Solutions", email: "aarav.sharma@techvista.in", phone: "+91 9845012345", tags: ["wedding", "corporate"] },
  { firstName: "Priya", lastName: "Patel", city: "Mumbai", state: "Maharashtra", company: "Patel Industries", email: "priya.patel@patelindustries.com", phone: "+91 9820167890", tags: ["wedding", "luxury"] },
  { firstName: "Vikram", lastName: "Reddy", city: "Hyderabad", state: "Telangana", company: "Reddy Enterprises", email: "vikram.reddy@reddyent.in", phone: "+91 9701234567", tags: ["reception", "sangeet"] },
  { firstName: "Ananya", lastName: "Gupta", city: "Delhi", state: "Delhi", company: "Gupta & Sons", email: "ananya.gupta@guptasons.com", phone: "+91 9811023456", tags: ["wedding", "destination"] },
  { firstName: "Rohan", lastName: "Kumar", city: "Chennai", state: "Tamil Nadu", company: "Kumar Tech", email: "rohan.kumar@kumartech.in", phone: "+91 9444078901", tags: ["corporate", "conference"] },
  { firstName: "Sneha", lastName: "Joshi", city: "Pune", state: "Maharashtra", company: "Joshi Exports", email: "sneha.joshi@joshiexports.com", phone: "+91 9823045678", tags: ["engagement", "wedding"] },
  { firstName: "Arjun", lastName: "Singh", city: "Bangalore", state: "Karnataka", company: "Singh Realty", email: "arjun.singh@singhrealty.in", phone: "+91 9845567890", tags: ["reception", "corporate"] },
  { firstName: "Meera", lastName: "Nair", city: "Kochi", state: "Kerala", company: "Nair Group", email: "meera.nair@nairgroup.com", phone: "+91 9447012345", tags: ["wedding", "traditional"] },
  { firstName: "Karthik", lastName: "Iyer", city: "Mumbai", state: "Maharashtra", company: "Iyer Consulting", email: "karthik.iyer@iyerconsult.in", phone: "+91 9821098765", tags: ["corporate", "gala"] },
  { firstName: "Divya", lastName: "Menon", city: "Hyderabad", state: "Telangana", company: "Menon Associates", email: "divya.menon@menonassoc.com", phone: "+91 9700345678", tags: ["wedding", "engagement"] },
  { firstName: "Rahul", lastName: "Verma", city: "Delhi", state: "Delhi", company: "Verma & Co.", email: "rahul.verma@vermaco.in", phone: "+91 9818076543", tags: ["birthday", "anniversary"] },
  { firstName: "Kavitha", lastName: "Rao", city: "Chennai", state: "Tamil Nadu", company: "Rao Builders", email: "kavitha.rao@raobuilders.com", phone: "+91 9445123456", tags: ["wedding", "south-indian"] },
];

const LEAD_TEMPLATES = [
  // 3 Facebook Ads leads
  { source: "FACEBOOK_ADS" as const, status: "NEW" as const, title: "Wedding Reception - Facebook Ad", eventType: "Wedding Reception", estimatedValue: 450000, guestCount: 250 },
  { source: "FACEBOOK_ADS" as const, status: "CONTACTED" as const, title: "Sangeet Night - Facebook Lead", eventType: "Sangeet", estimatedValue: 200000, guestCount: 150 },
  { source: "FACEBOOK_ADS" as const, status: "QUALIFIED" as const, title: "Engagement Ceremony - Meta Ads", eventType: "Engagement", estimatedValue: 350000, guestCount: 200 },
  // 3 Google Ads leads
  { source: "GOOGLE_ADS" as const, status: "NEW" as const, title: "Corporate Event - Google Ads", eventType: "Corporate", estimatedValue: 800000, guestCount: 500 },
  { source: "GOOGLE_ADS" as const, status: "CONTACTED" as const, title: "Destination Wedding - Google", eventType: "Wedding", estimatedValue: 1500000, guestCount: 400 },
  { source: "GOOGLE_ADS" as const, status: "PROPOSAL_SENT" as const, title: "Annual Gala - Google Lead", eventType: "Gala", estimatedValue: 600000, guestCount: 300 },
  // 2 Website/SEO leads
  { source: "WEBSITE" as const, status: "QUALIFIED" as const, title: "Wedding Package Inquiry - Website", eventType: "Wedding", estimatedValue: 500000, guestCount: 350 },
  { source: "WEBSITE" as const, status: "WON" as const, title: "Conference Booking - SEO", eventType: "Conference", estimatedValue: 300000, guestCount: 200 },
  // 2 Referral leads
  { source: "REFERRAL" as const, status: "NEGOTIATION" as const, title: "Reception - Referred by Sharma", eventType: "Reception", estimatedValue: 700000, guestCount: 450 },
  { source: "REFERRAL" as const, status: "WON" as const, title: "Wedding - Referred by Patel", eventType: "Wedding", estimatedValue: 1200000, guestCount: 600 },
  // 1 JustDial + 1 IndiaMart
  { source: "JUSTDIAL" as const, status: "NEW" as const, title: "Birthday Party - JustDial", eventType: "Birthday", estimatedValue: 150000, guestCount: 100 },
  { source: "INDIAMART" as const, status: "CONTACTED" as const, title: "Product Launch - IndiaMart", eventType: "Corporate", estimatedValue: 400000, guestCount: 250 },
];

const CALL_DISPOSITIONS = ["COMPLETED", "NO_ANSWER", "BUSY", "VOICEMAIL", "CALLBACK_REQUESTED", "COMPLETED", "COMPLETED", "NO_ANSWER", "COMPLETED", "COMPLETED"] as const;
const CALL_DIRECTIONS = ["OUTBOUND", "OUTBOUND", "INBOUND", "OUTBOUND", "INBOUND", "OUTBOUND", "OUTBOUND", "INBOUND", "OUTBOUND", "OUTBOUND"] as const;
const CALL_DURATIONS = [180, 0, 0, 45, 300, 120, 600, 0, 240, 450];
const CALL_NOTES = [
  "Discussed wedding package options. Client interested in premium package.",
  "No answer. Will try again tomorrow.",
  "Phone was busy. Sent WhatsApp message instead.",
  "Left voicemail about venue availability for March dates.",
  "Client called for pricing. Sent brochure via email.",
  "Follow-up call on quote sent. Client is comparing venues.",
  "Detailed discussion about catering menu and décor options.",
  "No answer. Third attempt this week.",
  "Confirmed guest count and finalized menu preferences.",
  "Discussed payment terms. Client agreed to 50% advance.",
];

const RECORDING_URLS = [
  "https://storage.veloriagrand.com/recordings/sample-call-001.mp3",
  null,
  null,
  "https://storage.veloriagrand.com/recordings/sample-call-004.mp3",
  "https://storage.veloriagrand.com/recordings/sample-call-005.mp3",
  "https://storage.veloriagrand.com/recordings/sample-call-006.mp3",
  "https://storage.veloriagrand.com/recordings/sample-call-007.mp3",
  null,
  "https://storage.veloriagrand.com/recordings/sample-call-008.mp3",
  "https://storage.veloriagrand.com/recordings/sample-call-010.mp3",
];

const EXTERNAL_CALL_IDS = [
  "exo_call_abc123",
  null,
  null,
  "kno_call_def456",
  null,
  "exo_call_ghi789",
  "myo_call_jkl012",
  null,
  null,
  "exo_call_mno345",
];

// ============================================================
// Main Seed Function
// ============================================================

export async function runSampleSeed() {
  console.log("🌱 Seeding sample data (additive — won't wipe existing data)...\n");

  // 1. Find the admin user to use as creator
  const adminUser = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true },
    select: { id: true },
  });

  if (!adminUser) {
    console.error("❌ No SUPER_ADMIN user found. Please run the main seed first.");
    process.exit(1);
  }

  const creatorId = adminUser.id;

  // Find all sales execs for assignment
  const salesExecs = await prisma.user.findMany({
    where: { role: "SALES_EXEC", isActive: true },
    select: { id: true },
  });
  const assignableUserIds = salesExecs.length > 0
    ? salesExecs.map((u) => u.id)
    : [creatorId];

  // 2. Create 12 sample contacts
  console.log("👥 Creating 12 sample contacts...");
  const contacts = await Promise.all(
    INDIAN_CONTACTS.map((c) =>
      prisma.contact.create({
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          company: c.company,
          city: c.city,
          state: c.state,
          tags: c.tags,
          type: "INDIVIDUAL",
          isActive: true,
        },
      })
    )
  );
  console.log(`   ✅ Created ${contacts.length} contacts`);

  // 3. Create 12 sample leads
  console.log("📋 Creating 12 sample leads from various sources...");
  const leads = await Promise.all(
    LEAD_TEMPLATES.map((tpl, i) =>
      prisma.lead.create({
        data: {
          title: tpl.title,
          status: tpl.status,
          source: tpl.source,
          estimatedValue: tpl.estimatedValue,
          eventType: tpl.eventType,
          guestCount: tpl.guestCount,
          eventDate: new Date(now.getFullYear(), now.getMonth() + randomInt(1, 6), randomInt(1, 28)),
          score: randomInt(20, 95),
          contactId: contacts[i].id,
          assignedToId: randomElement(assignableUserIds),
          createdById: creatorId,
          createdAt: subDays(now, randomInt(1, 30)),
        },
      })
    )
  );
  console.log(`   ✅ Created ${leads.length} leads`);
  console.log(`      Sources: ${LEAD_TEMPLATES.map((t) => t.source).join(", ")}`);

  // 4. Create 10 sample call logs with communications
  console.log("📞 Creating 10 sample call logs (6 with recording URLs)...");
  const callContacts = contacts.slice(0, 10);
  const callLogs = [];

  for (let i = 0; i < 10; i++) {
    const contact = callContacts[i];
    const createdAt = subHours(now, randomInt(2, 200));

    // Create Communication first
    const communication = await prisma.communication.create({
      data: {
        type: "CALL",
        direction: CALL_DIRECTIONS[i],
        content: CALL_NOTES[i],
        contactId: contact.id,
        createdById: creatorId,
        createdAt,
      },
    });

    // Create CallLog linked to communication
    const callLog = await prisma.callLog.create({
      data: {
        disposition: CALL_DISPOSITIONS[i],
        durationSeconds: CALL_DURATIONS[i],
        recordingUrl: RECORDING_URLS[i],
        externalCallId: EXTERNAL_CALL_IDS[i],
        notes: CALL_NOTES[i],
        tags: randomElement([["follow-up"], ["initial-call"], ["pricing"], ["site-visit"], []]),
        followUpDate: CALL_DISPOSITIONS[i] === "CALLBACK_REQUESTED"
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + randomInt(1, 7))
          : null,
        followUpNotes: CALL_DISPOSITIONS[i] === "CALLBACK_REQUESTED"
          ? "Client requested callback in the evening"
          : null,
        communicationId: communication.id,
        contactId: contact.id,
        agentId: randomElement(assignableUserIds),
        createdAt,
      },
    });

    callLogs.push(callLog);
  }
  console.log(`   ✅ Created ${callLogs.length} call logs`);
  console.log(`      With recordings: ${RECORDING_URLS.filter(Boolean).length}`);
  console.log(`      With externalCallId: ${EXTERNAL_CALL_IDS.filter(Boolean).length}`);

  // 5. Create auto-welcome configs (skip if already exist)
  console.log("💬 Creating auto-welcome configs...");
  const existingWelcome = await prisma.autoWelcomeConfig.count();
  if (existingWelcome === 0) {
    await prisma.autoWelcomeConfig.createMany({
      data: [
        {
          leadSource: "FACEBOOK_ADS",
          isEnabled: true,
          templateName: "facebook_welcome",
          delayMinutes: 0,
        },
        {
          leadSource: "GOOGLE_ADS",
          isEnabled: true,
          templateName: "google_welcome",
          delayMinutes: 5,
        },
        {
          leadSource: "WEBSITE",
          isEnabled: true,
          templateName: "website_welcome",
          delayMinutes: 2,
        },
      ],
    });
    console.log("   ✅ Created 3 auto-welcome configs (Facebook, Google, Website)");
  } else {
    console.log(`   ⏭️  Skipped — ${existingWelcome} auto-welcome configs already exist`);
  }

  // 6. Create placeholder telephony config (inactive)
  console.log("📱 Creating placeholder telephony config...");
  const existingTelephony = await prisma.telephonyConfig.count();
  if (existingTelephony === 0) {
    await prisma.telephonyConfig.create({
      data: {
        provider: "EXOTEL",
        apiKey: "your_exotel_api_key",
        apiSecret: "your_exotel_api_token",
        callerId: "08048764321",
        accountSid: "your_account_sid",
        subdomain: "api.exotel.com",
        webhookSecret: "veloria_telephony_secret",
        isActive: false,
        createdById: creatorId,
      },
    });
    console.log("   ✅ Created Exotel config (inactive — update credentials to activate)");
  } else {
    console.log(`   ⏭️  Skipped — ${existingTelephony} telephony configs already exist`);
  }

  // 7. Create lead capture configs (Facebook + Google)
  console.log("🔗 Creating lead capture configs...");
  const existingLCConfigs = await prisma.leadCaptureConfig.count();
  if (existingLCConfigs === 0) {
    await prisma.leadCaptureConfig.createMany({
      data: [
        {
          platform: "FACEBOOK",
          credentials: {
            appId: "123456789012345",
            accessToken: "EAA_placeholder_token",
            verifyToken: "veloria_fb_verify",
            pageId: "987654321098765",
          },
          isActive: true,
        },
        {
          platform: "GOOGLE",
          credentials: {
            webhookToken: "veloria_google_verify",
          },
          isActive: true,
        },
      ],
    });
    console.log("   ✅ Created 2 lead capture configs (Facebook + Google with placeholder creds)");
  } else {
    console.log(`   ⏭️  Skipped — ${existingLCConfigs} lead capture configs already exist`);
  }

  // 8. Create sample API key
  console.log("🔑 Creating sample API key...");
  const existingKeys = await prisma.apiKey.count();
  if (existingKeys === 0) {
    const sampleKey = `vel_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(sampleKey).digest("hex");
    const prefix = sampleKey.slice(0, 12);

    await prisma.apiKey.create({
      data: {
        name: "Development Test Key",
        keyHash,
        prefix,
        isActive: true,
        createdById: creatorId,
      },
    });
    console.log(`   ✅ Created API key: ${prefix}...`);
    console.log(`   🔐 Full key (save this!): ${sampleKey}`);
  } else {
    console.log(`   ⏭️  Skipped — ${existingKeys} API keys already exist`);
  }

  // 9. Create assignment rules for Facebook/Google leads (if none exist)
  console.log("📌 Creating assignment rules for ad leads...");
  const existingRules = await prisma.assignmentRule.count({
    where: { entityType: "LEAD" },
  });
  if (existingRules === 0) {
    await prisma.assignmentRule.createMany({
      data: [
        {
          name: "Facebook Leads → Round Robin",
          entityType: "LEAD",
          isActive: true,
          priority: 1,
          conditions: JSON.stringify([
            { field: "source", operator: "equals", value: "FACEBOOK_ADS" },
          ]),
          assignToTeam: assignableUserIds,
          assignmentMethod: "ROUND_ROBIN",
          lastAssignedIdx: 0,
        },
        {
          name: "Google Ads Leads → Round Robin",
          entityType: "LEAD",
          isActive: true,
          priority: 2,
          conditions: JSON.stringify([
            { field: "source", operator: "equals", value: "GOOGLE_ADS" },
          ]),
          assignToTeam: assignableUserIds,
          assignmentMethod: "ROUND_ROBIN",
          lastAssignedIdx: 0,
        },
      ],
    });
    console.log("   ✅ Created 2 assignment rules (Facebook → Round Robin, Google → Round Robin)");
  } else {
    console.log(`   ⏭️  Skipped — ${existingRules} assignment rules already exist`);
  }

  console.log("\n✨ Sample data seeded successfully!");
  console.log("   Open the app and check:");
  console.log("   • /contacts — 12 new contacts");
  console.log("   • /leads — 12 leads from Facebook, Google, Website, Referral, JustDial, IndiaMart");
  console.log("   • /crm/calls — 10 call logs (6 with recording URLs)");
  console.log("   • /settings/integrations/lead-capture — Facebook + Google configs");
  console.log("   • /settings/integrations/telephony — Exotel config (inactive)");
}

// Only run as CLI when executed directly via `pnpm db:seed-sample`.
// When imported (e.g., from a server action), nothing fires automatically.
if (require.main === module) {
  runSampleSeed()
    .catch((e) => {
      console.error("❌ Seed failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
