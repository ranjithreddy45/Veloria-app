import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || "info@theveloriagrand.com";
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    console.error("❌ SMTP_PASS is not set in .env!");
    process.exit(1);
  }

  console.log(`Connecting to ${host}:${port} as ${user}...`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified successfully! Google Business Email is ready for automations.");
  } catch (err: unknown) {
    console.error("❌ SMTP verification failed:", err);
  }
}

test();
