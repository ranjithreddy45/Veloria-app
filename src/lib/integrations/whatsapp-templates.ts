import { prisma } from "@/lib/prisma";

// ============================================================
// Pulling the approved template list out of Meta.
//
// THE PROBLEM: every template reference in this app is a free-text name —
// AutoWelcomeConfig.templateName, cadence steps, reminder templates. Nothing
// knew which templates existed, which were approved, what language they were
// in, or how many variables they took. A typo, or a template Meta later paused,
// failed at send time with an error nobody saw, and no screen could offer a
// picker because there was no list to pick from.
//
// This syncs Meta's list into WhatsAppTemplate so the CRM can offer the real,
// approved templates and refuse the rest.
//
// IT IS A MIRROR, NOT A SOURCE OF TRUTH. Meta owns approval state. The sync
// replaces what it finds rather than merging, so a template deleted or rejected
// upstream stops being offered here on the next run.
// ============================================================

const GRAPH_API_VERSION = "v21.0";

interface MetaTemplateComponent {
  type?: string;
  text?: string;
}

interface MetaTemplate {
  id?: string;
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  components?: MetaTemplateComponent[];
}

/**
 * Count the {{n}} placeholders in a template body.
 *
 * Sending the wrong number of parameters is the single most common template
 * failure and it is invisible from the caller's side — Meta rejects the message,
 * the customer gets nothing, and the CRM shows a sent row. Storing the expected
 * count lets the sender check before it goes out.
 */
export function countTemplateVariables(body: string | null | undefined): number {
  if (!body) return 0;
  const found = new Set<number>();
  for (const m of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) found.add(n);
  }
  // The highest index, not the match count: "{{1}} … {{1}} … {{3}}" needs three
  // parameters, because Meta positions them by number.
  return found.size === 0 ? 0 : Math.max(...found);
}

/** The BODY component's text, which is the part that carries the variables. */
function bodyTextOf(t: MetaTemplate): string | null {
  const body = t.components?.find((c) => (c.type ?? "").toUpperCase() === "BODY");
  return body?.text ?? null;
}

export interface TemplateSyncResult {
  ok: boolean;
  synced?: number;
  approved?: number;
  removed?: number;
  error?: string;
}

/**
 * Fetch every template on the business account and mirror it locally.
 *
 * Requires a META config with `businessAccountId` and a token carrying the
 * `whatsapp_business_management` scope. A Weflux-only setup has no such
 * credentials, and this says so plainly rather than failing with a Graph error
 * that means nothing to the person who pressed the button.
 */
export async function syncWhatsAppTemplates(): Promise<TemplateSyncResult> {
  const config = await prisma.whatsAppConfig.findFirst({ where: { isActive: true } });
  if (!config) return { ok: false, error: "No active WhatsApp configuration." };

  if (!config.businessAccountId) {
    return {
      ok: false,
      error:
        "Template sync reads Meta's WhatsApp Business Account directly, and no Business Account ID is saved. Add it in WhatsApp settings — you can copy it from WhatsApp Manager. A Weflux API key alone cannot list templates.",
    };
  }

  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.businessAccountId}/message_templates` +
    `?limit=200&fields=id,name,language,category,status,components`;

  let payload: { data?: MetaTemplate[]; error?: { message?: string } };
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      cache: "no-store",
    });
    payload = await res.json();
    if (!res.ok) {
      // Surface Meta's own words. A generic "sync failed" hides the two things
      // that are actually wrong in practice: a token without the
      // whatsapp_business_management scope, or the wrong account id.
      return { ok: false, error: payload?.error?.message || `Meta returned ${res.status}.` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach Meta." };
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  const seen: string[] = [];

  for (const t of rows) {
    if (!t.id || !t.name || !t.language) continue;
    const body = bodyTextOf(t);
    const data = {
      name: t.name,
      language: t.language,
      category: (t.category ?? "UTILITY").toUpperCase(),
      status: (t.status ?? "PENDING").toUpperCase(),
      body,
      variableCount: countTemplateVariables(body),
      components: (t.components ?? []) as object,
      syncedAt: new Date(),
    };
    await prisma.whatsAppTemplate.upsert({
      where: { metaId: t.id },
      create: { metaId: t.id, ...data },
      update: data,
    });
    seen.push(t.id);
  }

  // Drop anything Meta no longer returns. Keeping a stale row would let the UI
  // offer a template that cannot be sent — the exact failure this exists to
  // prevent.
  const removed = await prisma.whatsAppTemplate.deleteMany({
    where: seen.length ? { metaId: { notIn: seen } } : {},
  });

  return {
    ok: true,
    synced: seen.length,
    approved: rows.filter((t) => (t.status ?? "").toUpperCase() === "APPROVED").length,
    removed: removed.count,
  };
}

/** The templates that can actually be sent, for pickers. */
export async function listSendableTemplates() {
  return prisma.whatsAppTemplate.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ name: "asc" }, { language: "asc" }],
    select: {
      id: true,
      name: true,
      language: true,
      category: true,
      body: true,
      variableCount: true,
    },
  });
}
