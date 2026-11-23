import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function testConnection(host: string, port: number, secure: boolean, user: string, pass: string) {
  console.log(`\nTesting connection to ${host}:${port} (secure: ${secure})...`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
  });

  try {
    await transporter.verify();
    console.log(`✅ SUCCESS on ${host}:${port}! Credentials & TLS handshake verified.`);
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ FAILED on ${host}:${port}:`, errorMsg);
    return false;
  }
}

async function main() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const user = process.env.SMTP_USER || process.env.GOOGLE_EMAIL || "info@theveloriagrand.com";
  const pass = process.env.SMTP_PASS || process.env.GOOGLE_APP_PASSWORD;
  const configuredPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const configuredSecure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : undefined;

  if (!pass) {
    console.error("❌ SMTP_PASS is not set in .env!");
    process.exit(1);
  }

  console.log(`User: ${user}`);
  console.log(`Configured Port in .env: ${configuredPort ?? "(default 465)"}`);
  console.log(`Configured Secure in .env: ${configuredSecure ?? "(default true for 465)"}`);

  // Test configured or port 587 first (STARTTLS), then 465 (SSL)
  if (configuredPort) {
    const isSecure = configuredSecure !== undefined ? configuredSecure : configuredPort === 465;
    await testConnection(host, configuredPort, isSecure, user, pass);
  } else {
    console.log("\n--- Testing Port 587 (STARTTLS - recommended for VPS) ---");
    const ok587 = await testConnection(host, 587, false, user, pass);
    
    console.log("\n--- Testing Port 465 (SSL) ---");
    const ok465 = await testConnection(host, 465, true, user, pass);

    if (ok587 && !ok465) {
      console.log("\n💡 Recommendation: Set SMTP_PORT=587 and SMTP_SECURE=false in your VPS .env file because port 465 is intercepted by the VPS host.");
    }
  }
}

main();
