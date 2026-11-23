import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../src/lib/prisma";
import { sendLeadWelcomeEmail } from "../src/lib/crm/lead-welcome-email";

async function main() {
  console.log("Finding leads created in the last 48 hours...");
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: since },
    },
    include: {
      contact: true,
      assignedTo: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${leads.length} recent leads.`);

  let sentCount = 0;
  let skippedCount = 0;

  for (const lead of leads) {
    const contactEmail = lead.contact?.email?.trim();
    const contactName = `${lead.contact?.firstName || ""} ${lead.contact?.lastName || ""}`.trim() || lead.title;

    if (!contactEmail) {
      console.log(`⏭️  Skipping Lead #${lead.id} (${contactName}) — No email attached (Source: ${lead.source})`);
      skippedCount++;
      continue;
    }

    console.log(`📧 Sending welcome email to Lead #${lead.id}: ${contactName} <${contactEmail}>...`);
    const result = await sendLeadWelcomeEmail(lead.id);

    if (result.sent) {
      console.log(`  ✅ Successfully sent to ${contactEmail}`);
      sentCount++;
    } else {
      console.error(`  ❌ Failed to send to ${contactEmail}: ${result.reason}`);
    }
  }

  console.log(`\nSummary: ${sentCount} emails sent, ${skippedCount} skipped (no email address).`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
