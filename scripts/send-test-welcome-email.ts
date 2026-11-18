import dotenv from "dotenv";
dotenv.config();

import { sendEmail } from "../src/lib/email";
import { buildLeadWelcomeHtml } from "../src/lib/crm/lead-welcome-email";

async function main() {
  const recipient = "sourav@finalventure.io";
  console.log(`Sending test Lead Welcome Email to ${recipient}...`);

  const html = buildLeadWelcomeHtml({
    firstName: "Sourav",
    eventType: "Grand Wedding & Reception",
    eventDate: "28 November 2026",
    guestCount: 500,
    consultantName: "Pooja Mehta",
  });

  const res = await sendEmail({
    to: recipient,
    subject: "Thank you for reaching out to Veloria Grand | Enquiry Received",
    html,
  });

  console.log("Result:", JSON.stringify(res, null, 2));
  if (res.success) {
    console.log("✅ Email sent successfully to", recipient);
  } else {
    console.error("❌ Failed to send email:", res.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
