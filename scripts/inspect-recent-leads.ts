import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../src/lib/prisma";

async function main() {
  const leads = await prisma.lead.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
    include: {
      contact: true,
      assignedTo: true,
    },
  });

  console.log(`\n--- Most Recent ${leads.length} Leads in Database ---`);
  for (const l of leads) {
    const contactName = `${l.contact?.firstName || ""} ${l.contact?.lastName || ""}`.trim() || "(No name)";
    console.log({
      id: l.id,
      title: l.title,
      source: l.source,
      status: l.status,
      contactName,
      contactEmail: l.contact?.email || null,
      contactPhone: l.contact?.phone || null,
      assignedRep: l.assignedTo ? `${l.assignedTo.name} <${l.assignedTo.email}>` : null,
      createdAt: l.createdAt.toISOString(),
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
