// ============================================================
// Talking to Meta's Graph API for lead ads.
// ------------------------------------------------------------
// One place that owns the token, so there is one answer to "why did leads stop"
// instead of four. The last outage lasted a day and a half and cost 275 leads:
// the stored credential was a personal user token that expired the moment its
// owner's session ended, and nothing noticed because every failure was a log
// line nobody reads. So error 190 — the code Meta returns for a dead token —
// raises an admin alert here, at the only place it can be seen.
//
// Credentials come from the environment first, as the spec asks, and fall back
// to the Lead Capture settings row so the token can be replaced from the admin
// screen without a deploy. Neither is ever logged.
// ============================================================

import { prisma } from "@/lib/prisma";
import { reportSystemFailure } from "@/lib/ops-alert";

export const DEFAULT_GRAPH_VERSION = "v21.0";

export const LEAD_FIELDS =
  "id,created_time,field_data,form_id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,platform,is_organic";

export interface MetaCredentials {
  pageAccessToken: string;
  appId: string;
  appSecret: string;
  verifyToken: string;
  pageId: string;
  graphVersion: string;
  /** Where the token came from, for the health screen. Never the value. */
  tokenSource: "env" | "settings" | "none";
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Resolve the credentials once per call.
 *
 * Deliberately not cached in a module variable: the whole point of the settings
 * fallback is that pasting a new token fixes the outage immediately, and a
 * cached token would keep the outage alive until the next deploy.
 */
export async function getMetaCredentials(): Promise<MetaCredentials> {
  const fromEnv = {
    pageAccessToken: env("META_PAGE_ACCESS_TOKEN"),
    appId: env("META_APP_ID"),
    appSecret: env("META_APP_SECRET"),
    verifyToken: env("META_VERIFY_TOKEN"),
    pageId: env("META_PAGE_ID"),
    graphVersion: env("META_GRAPH_VERSION") || DEFAULT_GRAPH_VERSION,
  };

  let stored: Record<string, string> = {};
  try {
    const config = await prisma.leadCaptureConfig.findFirst({
      where: { platform: "FACEBOOK", isActive: true },
    });
    if (config?.credentials && typeof config.credentials === "object") {
      stored = config.credentials as Record<string, string>;
    }
  } catch {
    // A settings read failure must not take the webhook down; env may be enough.
  }

  const pageAccessToken = fromEnv.pageAccessToken || (stored.accessToken ?? "").trim();

  return {
    pageAccessToken,
    appId: fromEnv.appId || (stored.appId ?? "").trim(),
    appSecret: fromEnv.appSecret || (stored.appSecret ?? "").trim(),
    verifyToken: fromEnv.verifyToken || (stored.verifyToken ?? "").trim(),
    pageId: fromEnv.pageId || (stored.pageId ?? "").trim(),
    graphVersion: fromEnv.graphVersion,
    tokenSource: fromEnv.pageAccessToken ? "env" : pageAccessToken ? "settings" : "none",
  };
}

export class MetaGraphError extends Error {
  code: number;
  subcode?: number;
  constructor(message: string, code: number, subcode?: number) {
    super(message);
    this.name = "MetaGraphError";
    this.code = code;
    this.subcode = subcode;
  }
  /** A dead or revoked token. Retrying will not fix it; a person must. */
  get isTokenProblem(): boolean {
    return this.code === 190 || this.code === 102 || this.code === 10;
  }
}

// One alert an hour at most: a dead token fails every delivery, and forty
// identical alerts would train everyone to ignore them.
let lastTokenAlertAt = 0;
const TOKEN_ALERT_GAP_MS = 60 * 60 * 1000;

async function alertTokenDead(detail: string): Promise<void> {
  if (Date.now() - lastTokenAlertAt < TOKEN_ALERT_GAP_MS) return;
  lastTokenAlertAt = Date.now();
  await reportSystemFailure({
    area: "Meta lead ads",
    title: "Facebook leads are NOT reaching the CRM",
    detail: `${detail} Replace the Page access token in Settings, Integrations, Lead Capture, Facebook. Use a System User token so it cannot expire with someone's login.`,
    actionUrl: "/settings/integrations/lead-capture",
  }).catch(() => undefined);
}

/**
 * One Graph call. Returns parsed JSON, throws MetaGraphError on Meta's own
 * error envelope (which arrives with HTTP 200 as often as not).
 */
export async function graph<T = Record<string, unknown>>(
  path: string,
  creds: MetaCredentials
): Promise<T> {
  if (!creds.pageAccessToken) {
    await alertTokenDead("No Page access token is configured.");
    throw new MetaGraphError("No Meta page access token configured", 190);
  }

  const joiner = path.includes("?") ? "&" : "?";
  const url = `https://graph.facebook.com/${creds.graphVersion}/${path}${joiner}access_token=${encodeURIComponent(
    creds.pageAccessToken
  )}`;

  let json: Record<string, unknown>;
  try {
    const res = await fetch(url, { cache: "no-store" });
    json = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    throw new MetaGraphError(
      `Could not reach Meta: ${e instanceof Error ? e.message : "network error"}`,
      0
    );
  }

  const error = json.error as { message?: string; code?: number; error_subcode?: number } | undefined;
  if (error) {
    const err = new MetaGraphError(
      error.message ?? "Unknown Graph error",
      Number(error.code ?? 0),
      error.error_subcode
    );
    if (err.isTokenProblem) await alertTokenDead(`Meta says: "${err.message}".`);
    throw err;
  }
  return json as T;
}

/** One lead, with everything the CRM stores. */
export async function fetchLead(leadgenId: string, creds: MetaCredentials) {
  return graph(`${encodeURIComponent(leadgenId)}?fields=${LEAD_FIELDS}`, creds);
}

// Form names change rarely and are asked for on every lead, so they are cached
// for the life of the process. A stale name is cosmetic; a rate limit is not.
const formNames = new Map<string, { name: string; at: number }>();
const FORM_NAME_TTL_MS = 6 * 60 * 60 * 1000;

export async function fetchFormName(
  formId: string,
  creds: MetaCredentials
): Promise<string | null> {
  if (!formId) return null;
  const hit = formNames.get(formId);
  if (hit && Date.now() - hit.at < FORM_NAME_TTL_MS) return hit.name;
  try {
    const res = await graph<{ name?: string }>(`${encodeURIComponent(formId)}?fields=name`, creds);
    const name = res.name ?? null;
    if (name) formNames.set(formId, { name, at: Date.now() });
    return name;
  } catch {
    // A missing form name must never stop a lead being saved.
    return null;
  }
}

export interface PagedLeads {
  data: Record<string, unknown>[];
  nextUrl: string | null;
}

/** One page of a form's leads, newest first, created after `sinceUnix`. */
export async function fetchFormLeads(
  formId: string,
  sinceUnix: number,
  creds: MetaCredentials
): Promise<PagedLeads> {
  const filtering = encodeURIComponent(
    JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: sinceUnix }])
  );
  const res = await graph<{ data?: Record<string, unknown>[]; paging?: { next?: string } }>(
    `${encodeURIComponent(formId)}/leads?fields=${LEAD_FIELDS}&limit=100&filtering=${filtering}`,
    creds
  );
  return { data: res.data ?? [], nextUrl: res.paging?.next ?? null };
}

/** Follow a paging.next URL, which already carries its own token and query. */
export async function fetchNextPage(nextUrl: string): Promise<PagedLeads> {
  const res = await fetch(nextUrl, { cache: "no-store" });
  const json = (await res.json()) as {
    data?: Record<string, unknown>[];
    paging?: { next?: string };
    error?: { message?: string; code?: number };
  };
  if (json.error) {
    throw new MetaGraphError(json.error.message ?? "Graph error", Number(json.error.code ?? 0));
  }
  return { data: json.data ?? [], nextUrl: json.paging?.next ?? null };
}

/** Every lead form on the page, so the backfill knows what to poll. */
export async function fetchPageForms(creds: MetaCredentials) {
  const res = await graph<{ data?: { id: string; name?: string; status?: string }[] }>(
    `${encodeURIComponent(creds.pageId)}/leadgen_forms?fields=id,name,status&limit=100`,
    creds
  );
  return res.data ?? [];
}

export interface TokenHealth {
  valid: boolean;
  type?: string;
  expiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
  scopes: string[];
  message?: string;
}

/**
 * Is the token alive, and what kind is it?
 *
 * The type matters as much as the validity: a USER token works right up until
 * the person it belongs to logs out, which is exactly how the last outage
 * happened. The health screen says so rather than just "valid".
 */
export async function checkToken(creds: MetaCredentials): Promise<TokenHealth> {
  if (!creds.pageAccessToken) {
    return { valid: false, expiresAt: null, dataAccessExpiresAt: null, scopes: [], message: "No token configured" };
  }
  if (!creds.appId || !creds.appSecret) {
    // Without the app credentials we can still prove the token works at all.
    try {
      await graph("me?fields=id,name", creds);
      return { valid: true, expiresAt: null, dataAccessExpiresAt: null, scopes: [], message: "Token works; app id/secret not set, so its type and expiry are unknown" };
    } catch (e) {
      return {
        valid: false,
        expiresAt: null,
        dataAccessExpiresAt: null,
        scopes: [],
        message: e instanceof Error ? e.message : "Token rejected",
      };
    }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${creds.graphVersion}/debug_token?input_token=${encodeURIComponent(
        creds.pageAccessToken
      )}&access_token=${encodeURIComponent(`${creds.appId}|${creds.appSecret}`)}`,
      { cache: "no-store" }
    );
    const json = (await res.json()) as {
      data?: {
        is_valid?: boolean;
        type?: string;
        expires_at?: number;
        data_access_expires_at?: number;
        scopes?: string[];
      };
      error?: { message?: string };
    };
    const d = json.data ?? {};
    return {
      valid: Boolean(d.is_valid),
      type: d.type,
      expiresAt: d.expires_at ? new Date(d.expires_at * 1000) : null,
      dataAccessExpiresAt: d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000) : null,
      scopes: d.scopes ?? [],
      message: json.error?.message,
    };
  } catch (e) {
    return {
      valid: false,
      expiresAt: null,
      dataAccessExpiresAt: null,
      scopes: [],
      message: e instanceof Error ? e.message : "debug_token failed",
    };
  }
}

/** Is our app still subscribed to the page's leadgen field? */
export async function checkSubscription(
  creds: MetaCredentials
): Promise<{ subscribed: boolean; apps: string[]; message?: string }> {
  try {
    const res = await graph<{
      data?: { id?: string; name?: string; subscribed_fields?: string[] }[];
    }>(`${encodeURIComponent(creds.pageId)}/subscribed_apps`, creds);
    const apps = res.data ?? [];
    const subscribed = apps.some((a) => (a.subscribed_fields ?? []).includes("leadgen"));
    return { subscribed, apps: apps.map((a) => a.name ?? a.id ?? "unknown") };
  } catch (e) {
    return { subscribed: false, apps: [], message: e instanceof Error ? e.message : "check failed" };
  }
}
