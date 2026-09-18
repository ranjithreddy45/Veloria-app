/**
 * Sample halls, for looking at the customer app with a realistic number of
 * spaces before the real ones are entered.
 *
 *   set -a; . ./.env; set +a
 *   npx tsx scripts/sample-halls.ts --create 45
 *   npx tsx scripts/sample-halls.ts --remove
 *
 * What it does and does NOT do:
 *   - Every hall it creates ends its description with SAMPLE_MARKER. That is
 *     the only thing that identifies them, so --remove needs no bookkeeping
 *     file and can never delete a hall the team entered.
 *   - Pictures are the illustrations bundled with the app (/guest/photos). The
 *     app already labels those "Illustration", so a sample hall never claims a
 *     photo of a room that doesn't exist.
 *   - --remove refuses to delete a hall that has anything attached (a booking,
 *     quotation, hold, lead, blackout...), and says which it skipped.
 *   - It never touches a hall it did not create.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const SAMPLE_MARKER = "Sample listing for design preview — not a real hall.";

const LOCALITIES = [
  "Whitefield", "Koramangala", "Jayanagar", "HSR Layout", "Marathahalli", "Rajajinagar",
  "Malleshwaram", "Banashankari", "Electronic City", "Sarjapur Road", "Hennur", "Yeshwanthpur",
  "Kengeri", "Basavanagudi", "RT Nagar", "Vijayanagar", "Nagarbhavi", "KR Puram",
  "Frazer Town", "Sahakar Nagar", "Bommanahalli", "Kanakapura Road", "Old Airport Road", "Devanahalli",
  "Hesaraghatta",
];

const PREFIXES = ["Amber", "Ivory", "Lotus", "Marigold", "Emerald", "Saffron", "Coral", "Indigo", "Opal"];
const KINDS = ["Hall", "Pavilion", "Courtyard", "Banquets", "Convention Centre", "Gardens", "Atrium"];

/** Capacities that land in every band the browse chips offer. */
const CAPACITIES = [80, 120, 150, 180, 200, 240, 300, 350, 420, 500, 650, 800, 1000, 1400, 1800, 2400];

const AMENITIES = [
  "Air-conditioned halls",
  "Ample parking & valet",
  "In-house Veg / Non-Veg / Jain catering",
  "Stage sound & lighting",
  "Bridal / green room",
  "Outside decorators welcome",
  "Outdoor lawn",
  "Rooftop terrace",
  "Dance floor",
  "Live counters",
  "Projector & screen",
  "Step-free entrance",
  "Power backup",
];

const PHOTOS: { file: string; title: string }[] = [
  { file: "banquet", title: "Banquet floor" },
  { file: "stage", title: "Stage" },
  { file: "chandelier", title: "Main hall" },
  { file: "entrance", title: "Entrance" },
  { file: "arch", title: "Mandap" },
  { file: "tables", title: "Seating" },
  { file: "chairs", title: "Seating" },
  { file: "flowers", title: "Decor" },
  { file: "jasmine", title: "Decor" },
  { file: "orchid", title: "Decor" },
  { file: "terrace", title: "Terrace" },
  { file: "tents", title: "Lawn" },
  { file: "tentnight", title: "Lawn by night" },
  { file: "dance", title: "Dance floor" },
  { file: "confetti", title: "Celebration" },
  { file: "welcome", title: "Welcome" },
];

const DESCRIPTIONS = [
  "A pillarless hall with a high ceiling, suited to weddings and receptions.",
  "A garden-side space that works for mehendi, sangeet and daytime functions.",
  "A compact hall for naming ceremonies, birthdays and family gatherings.",
  "A banquet floor with an adjoining pre-function area for guests to gather.",
  "A rooftop space for evening receptions, with the skyline behind the stage.",
  "A convention floor for corporate days, conferences and large receptions.",
];

function pick<T>(items: readonly T[], i: number): T {
  return items[i % items.length];
}

/** A spread of amenities that differs hall to hall but always looks plausible. */
function amenitiesFor(i: number): string[] {
  const count = 4 + (i % 4);
  const out: string[] = [];
  for (let k = 0; k < count; k++) out.push(pick(AMENITIES, i * 3 + k * 5));
  return Array.from(new Set(out));
}

function priceFor(capacity: number, i: number): number {
  const base = capacity * 110 + (i % 5) * 4000;
  return Math.max(18000, Math.round(base / 1000) * 1000);
}

function pinFor(i: number): string {
  return `5600${String(11 + (i % 88)).padStart(2, "0")}`;
}

async function create(count: number) {
  const uploader =
    (await prisma.user.findFirst({ where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true }, select: { id: true } })) ??
    (await prisma.user.findFirst({ select: { id: true } }));
  if (!uploader) throw new Error("No user to attribute the sample pictures to.");

  let made = 0;
  let skipped = 0;
  for (let i = 0; i < count; i++) {
    const locality = pick(LOCALITIES, i);
    const name = `${pick(PREFIXES, i)} ${pick(KINDS, Math.floor(i / 3))} — ${locality}`;
    if (await prisma.venue.findFirst({ where: { name }, select: { id: true } })) {
      skipped++;
      continue;
    }
    const capacity = pick(CAPACITIES, i);
    const venue = await prisma.venue.create({
      data: {
        name,
        capacity,
        pricePerSlot: priceFor(capacity, i),
        amenities: amenitiesFor(i),
        description: `${pick(DESCRIPTIONS, i)} ${SAMPLE_MARKER}`,
        publicAddress: `${name.split(" — ")[0]}, ${locality}, Bengaluru ${pinFor(i)}`,
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${locality}, Bengaluru`)}`,
        parkingInfo: i % 3 === 0 ? "Valet parking at the gate; open parking for about 60 cars." : null,
        directionsNote: i % 4 === 0 ? `Off the main road in ${locality}; the turn is beside the bus stop.` : null,
        inHouseCateringRequired: i % 5 === 0,
        inHouseCateringNote: i % 5 === 0 ? "Catering is by our in-house kitchen." : null,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    const shots = 3 + (i % 4);
    await prisma.galleryItem.createMany({
      data: Array.from({ length: shots }, (_, k) => {
        const photo = pick(PHOTOS, i * 5 + k * 3);
        return {
          title: photo.title,
          mediaType: "PHOTO",
          kind: "VENUE",
          url: `/guest/photos/${photo.file}.jpg`,
          isPublic: true,
          order: k,
          venueId: venue.id,
          uploadedById: uploader.id,
        };
      }),
    });
    made++;
  }
  console.log(`created ${made} sample halls (skipped ${skipped} that already existed)`);
}

async function remove() {
  const samples = await prisma.venue.findMany({
    where: { description: { contains: SAMPLE_MARKER } },
    select: {
      id: true,
      name: true,
      _count: {
        select: { bookings: true, salesQuotations: true, publicHolds: true, blackoutDates: true, preferredLeads: true, siteVisits: true },
      },
    },
  });
  let gone = 0;
  const kept: string[] = [];
  for (const venue of samples) {
    const attached = Object.values(venue._count).reduce((sum, n) => sum + n, 0);
    if (attached > 0) {
      kept.push(`${venue.name} (${attached} record${attached === 1 ? "" : "s"} attached)`);
      continue;
    }
    await prisma.galleryItem.deleteMany({ where: { venueId: venue.id } });
    await prisma.venue.delete({ where: { id: venue.id } });
    gone++;
  }
  console.log(`removed ${gone} sample halls`);
  if (kept.length > 0) console.log(`kept ${kept.length} with records attached:\n  ${kept.join("\n  ")}`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === "--create") {
    const count = Number(process.argv[3] ?? 45);
    if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error("--create needs a count between 1 and 200");
    await create(count);
  } else if (mode === "--remove") {
    await remove();
  } else {
    console.log("usage: tsx scripts/sample-halls.ts --create [count] | --remove");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
