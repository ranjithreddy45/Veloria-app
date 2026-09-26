// ============================================================
// The safety net: poll Meta for leads the webhook never delivered.
// ------------------------------------------------------------
// Meta retries a failed webhook for a while and then stops for good. That is
// exactly how 275 leads were lost while a dead token was left in place: every
// delivery failed, the retries ran out, and the leads existed only in Meta's
// own Leads Centre. A poll costs one API call per form and makes the webhook
// non-critical — if it misses, this catches it within the hour.
//
// Everything goes through the same processor as the webhook, which dedupes on
// the Meta lead id, so running this twice imports nothing twice.
// ============================================================

import { prisma } from "@/lib/prisma";

import { fetchFormLeads, fetchNextPage, fetchPageForms, getMetaCredentials } from "./graph";
import { processMetaLeadPayload } from "./process-lead";
import type { MetaLeadPayload } from "./field-map";

export interface BackfillSummary {
  ok: boolean;
  forms: number;
  seen: number;
  captured: number;
  duplicates: number;
  skipped: number;
  errors: number;
  since: string;
  note?: string;
}

const MAX_PAGES_PER_FORM = 10; // 1,000 leads per form per run is plenty

/**
 * Import every lead created since `since` that the CRM does not already have.
 *
 * @param since  How far back to look. Defaults to 72 hours, which comfortably
 *               covers Meta's own retry window plus a night nobody was awake.
 */
export async function runMetaBackfill(options?: {
  since?: Date;
  hours?: number;
}): Promise<BackfillSummary> {
  const since =
    options?.since ?? new Date(Date.now() - (options?.hours ?? 72) * 60 * 60 * 1000);
  const sinceUnix = Math.floor(since.getTime() / 1000);
  const summary: BackfillSummary = {
    ok: true,
    forms: 0,
    seen: 0,
    captured: 0,
    duplicates: 0,
    skipped: 0,
    errors: 0,
    since: since.toISOString(),
  };

  const creds = await getMetaCredentials();
  if (!creds.pageAccessToken) {
    return { ...summary, ok: false, note: "No Meta page access token is configured." };
  }
  if (!creds.pageId) {
    return { ...summary, ok: false, note: "META_PAGE_ID is not set, so there is no page to poll." };
  }

  let forms: { id: string; name?: string; status?: string }[] = [];
  try {
    forms = await fetchPageForms(creds);
  } catch (e) {
    return {
      ...summary,
      ok: false,
      note: `Could not list the page's lead forms: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
  summary.forms = forms.length;

  for (const form of forms) {
    try {
      let page = await fetchFormLeads(form.id, sinceUnix, creds);
      let pageCount = 0;

      while (true) {
        for (const raw of page.data) {
          const payload = raw as MetaLeadPayload;
          summary.seen++;
          try {
            const outcome = await processMetaLeadPayload(
              { ...payload, form_id: payload.form_id ?? form.id },
              creds
            );
            if (outcome.status === "captured") summary.captured++;
            else if (outcome.status === "duplicate") summary.duplicates++;
            else summary.skipped++;
          } catch (e) {
            summary.errors++;
            console.error("[MetaBackfill] lead failed", payload.id, e);
          }
        }

        pageCount++;
        if (!page.nextUrl || pageCount >= MAX_PAGES_PER_FORM) break;
        page = await fetchNextPage(page.nextUrl);
      }
    } catch (e) {
      summary.errors++;
      summary.ok = false;
      console.error("[MetaBackfill] form failed", form.id, e);
    }
  }

  return summary;
}

/** When did a Meta lead last reach the CRM? Used by the health check. */
export async function lastMetaLeadAt(): Promise<Date | null> {
  const row = await prisma.metaLeadCapture.findFirst({
    where: { isTest: false },
    orderBy: { receivedAt: "desc" },
    select: { receivedAt: true },
  });
  return row?.receivedAt ?? null;
}
