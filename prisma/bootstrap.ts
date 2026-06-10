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

const prisma = new PrismaClient();

async function main() {
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

  // ---- 2. Ensure default pipeline stages exist ----
  const stageCount = await prisma.pipelineStage.count();
  if (stageCount === 0) {
    await prisma.pipelineStage.createMany({
      data: [
        { name: "New Inquiry", order: 1, color: "#6366f1", isDefault: true },
        { name: "Site Visit", order: 2, color: "#8b5cf6" },
        { name: "Proposal Sent", order: 3, color: "#3b82f6" },
        { name: "Negotiation", order: 4, color: "#f59e0b" },
        { name: "Won", order: 5, color: "#10b981", isWonStage: true },
        { name: "Lost", order: 6, color: "#ef4444", isLostStage: true },
      ],
    });
    console.log("[bootstrap] Created 6 default pipeline stages");
  } else {
    console.log(`[bootstrap] Pipeline stages already exist (${stageCount})`);
  }

  // ---- 3. Ensure starter venues exist (so the guest app isn't empty) ----
  // Placeholder details — edit anytime in Settings → Venues.
  const venueCount = await prisma.venue.count();
  if (venueCount === 0) {
    await prisma.venue.createMany({
      data: [
        {
          name: "Grand Ballroom",
          description:
            "Our flagship hall — soaring ceilings, crystal chandeliers, and a grand stage. Perfect for weddings and large receptions.",
          capacity: 300,
          pricePerSlot: 150000,
          amenities: [
            "Air-conditioned",
            "Stage & green room",
            "Valet parking",
            "Bridal suite",
            "In-house sound & lighting",
            "Outside caterers welcome",
          ],
          isActive: true,
        },
        {
          name: "Garden Pavilion",
          description:
            "A lush open-air lawn with a covered pavilion — ideal for sangeet, engagements, and evening celebrations under the stars.",
          capacity: 200,
          pricePerSlot: 100000,
          amenities: [
            "Open-air lawn",
            "Covered pavilion",
            "Mood lighting",
            "Valet parking",
            "Power backup",
            "Outside caterers welcome",
          ],
          isActive: true,
        },
        {
          name: "Celebration Hall",
          description:
            "An intimate, elegant space for birthdays, anniversaries, and corporate gatherings of up to 80 guests.",
          capacity: 80,
          pricePerSlot: 50000,
          amenities: [
            "Air-conditioned",
            "Projector & screen",
            "Wi-Fi",
            "Parking",
            "Flexible seating",
            "Outside caterers welcome",
          ],
          isActive: true,
        },
      ],
    });
    console.log("[bootstrap] Created 3 starter venues");
  } else {
    console.log(`[bootstrap] Venues already exist (${venueCount})`);
  }

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
    const venue = await prisma.venue.findFirst({ select: { id: true } });
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

  console.log("[bootstrap] Done.");
}

main()
  .catch((e) => {
    console.error("[bootstrap] Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
