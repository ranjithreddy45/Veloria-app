// ============================================================
// Is the Meta connection actually alive?
// ------------------------------------------------------------
// The last outage ran for a day and a half before anyone noticed, because a
// broken integration and a quiet one look identical from the CRM. Three checks,
// run daily and shown on the integrations screen:
//
//   1. the token still works, and is not the kind that expires with a person
//   2. the app is still subscribed to the page's leadgen field
//   3. leads are still arriving
//
// The first two failing means leads are being lost right now, so they alert.
// The third is a warning: a quiet day is not a fault.
// ============================================================

import { reportSystemFailure } from "@/lib/ops-alert";

import { lastMetaLeadAt } from "./backfill";
import { checkSubscription, checkToken, getMetaCredentials } from "./graph";

export interface MetaHealth {
  ok: boolean;
  tokenValid: boolean;
  tokenType?: string;
  tokenExpiresAt: string | null;
  tokenSource: "env" | "settings" | "none";
  /** A user token dies when its owner logs out. That is what happened before. */
  tokenIsPersonal: boolean;
  subscribed: boolean;
  subscribedApps: string[];
  lastLeadAt: string | null;
  hoursSinceLastLead: number | null;
  problems: string[];
  warnings: string[];
}

const QUIET_HOURS_WARNING = 48;

export async function checkMetaHealth(options?: { alert?: boolean }): Promise<MetaHealth> {
  const creds = await getMetaCredentials();
  const problems: string[] = [];
  const warnings: string[] = [];

  const token = await checkToken(creds);
  if (!token.valid) {
    problems.push(
      token.message
        ? `The Meta token is not valid: ${token.message}`
        : "The Meta token is not valid."
    );
  }

  // A page token from a system user has no expiry and no owner to log out. A
  // USER token is the failure that already cost 275 leads, so it is called out
  // even while it still works.
  const tokenIsPersonal = (token.type ?? "").toUpperCase() === "USER";
  if (token.valid && tokenIsPersonal) {
    warnings.push(
      "This is a personal user token. It will stop working when that person logs out or leaves. Replace it with a System User token."
    );
  }
  if (token.valid && token.expiresAt && token.expiresAt.getTime() - Date.now() < 7 * 864e5) {
    warnings.push(`The token expires on ${token.expiresAt.toISOString().slice(0, 10)}.`);
  }

  const subscription = await checkSubscription(creds);
  if (!subscription.subscribed) {
    problems.push(
      subscription.message
        ? `The page is not subscribed to leadgen: ${subscription.message}`
        : "The app is not subscribed to the page's leadgen field, so Meta will not send leads."
    );
  }

  const lastLead = await lastMetaLeadAt().catch(() => null);
  const hoursSince = lastLead ? (Date.now() - lastLead.getTime()) / 3.6e6 : null;
  if (hoursSince != null && hoursSince > QUIET_HOURS_WARNING) {
    warnings.push(`No Meta lead has arrived for ${Math.floor(hoursSince)} hours.`);
  }
  if (!lastLead) warnings.push("No Meta lead has ever reached the CRM.");

  const health: MetaHealth = {
    ok: problems.length === 0,
    tokenValid: token.valid,
    tokenType: token.type,
    tokenExpiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
    tokenSource: creds.tokenSource,
    tokenIsPersonal,
    subscribed: subscription.subscribed,
    subscribedApps: subscription.apps,
    lastLeadAt: lastLead ? lastLead.toISOString() : null,
    hoursSinceLastLead: hoursSince == null ? null : Math.round(hoursSince),
    problems,
    warnings,
  };

  if (options?.alert && problems.length > 0) {
    await reportSystemFailure({
      area: "Meta lead ads",
      title: "Facebook leads are not reaching the CRM",
      detail: `${problems.join(" ")} Fix it in Settings, Integrations, Lead Capture, Facebook.`,
      actionUrl: "/settings/integrations/lead-capture",
    }).catch(() => undefined);
  }

  return health;
}
