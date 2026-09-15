/**
 * Generate a VAPID key pair for Web Push.
 *
 * Usage:  npx tsx scripts/generate-vapid-keys.ts
 *
 * This is the ONLY place keys are printed. Run it ONCE per environment and
 * paste the output into .env (local), ~/Desktop/veloria-secrets.env (VPS) or
 * the hosting provider's env settings. Rotating the pair invalidates every
 * existing device subscription (each user has to re-enable), so keep the
 * private key safe and don't regenerate casually.
 */

import * as webPush from "web-push";

const { publicKey, privateKey } = webPush.generateVAPIDKeys();

const companyEmail = (process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? "").trim();
const subject =
  (process.env.VAPID_SUBJECT ?? "").trim() ||
  (companyEmail.includes("@") ? `mailto:${companyEmail}` : "mailto:you@yourdomain.com");

const lines = [
  "",
  "Web Push VAPID keys generated. Add these to your environment:",
  "",
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"`,
  `VAPID_PRIVATE_KEY="${privateKey}"`,
  `VAPID_SUBJECT="${subject}"`,
  "",
  "Notes:",
  "  - NEXT_PUBLIC_VAPID_PUBLIC_KEY is safe to expose; VAPID_PRIVATE_KEY is a secret.",
  "  - VAPID_SUBJECT must be a mailto: address or an https:// URL (edit the placeholder).",
  "  - All three must be set; otherwise push is silently disabled (one server warn).",
  "  - Restart the app after setting them. Users enable push from the bell menu.",
  "  - Keep this pair forever: regenerating it breaks every existing subscription.",
  "",
];

process.stdout.write(lines.join("\n"));
