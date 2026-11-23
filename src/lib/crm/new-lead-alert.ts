import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { reportSystemFailure } from "@/lib/ops-alert";

// ============================================================
// "A new lead just came in" — one email to a fixed list of people.
//
// The owner wants a named group (sales heads, partners) told about EVERY new
// lead the moment it lands, whatever channel it came from and whoever it is
// assigned to. That is different from the two emails that already exist:
//   - lead-assigned-email  → only the one rep who now owns the lead
//   - lead-welcome-email   → the customer
//
// The list lives in the NEW_LEAD_ALERT_EMAILS environment variable
// (comma-separated). Unset or empty means no alert, so this is inert until
// someone turns it on.
//
// Fired from runLeadIntake (every captured / webform / manually created lead)
// plus the two paths that create leads without it (referral conversion and the
// AI assistant). Bulk imports and historical backfills are deliberately NOT
// alerted: a 500-row sheet import would send 500 emails to every recipient.
//
// Delivery is durable: enqueueNewLeadAlert writes a LeadAlertDelivery row, then
// sends detached from the caller, so a slow or unreachable mail server never
// delays a webhook response or a form submit, and a failed send is retried by
// the 5-minute fast cron lane (processDueLeadAlerts) until it goes out.
// ============================================================

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Parse the recipient list: comma/semicolon/space separated, deduped, validated. */
export function parseAlertRecipients(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const addr = part.trim().toLowerCase();
    if (!addr || !EMAIL_RE.test(addr) || seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.theveloriagrand.com";
  return `${base}${path}`;
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const IST_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const IST_DATETIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Lead descriptions carry internal dedupe markers like "[ext:123]" — never show those. */
function cleanNotes(description: string | null | undefined): string {
  if (!description) return "";
  const text = description.replace(/\[ext:[^\]]*\]/g, "").replace(/\s+\n/g, "\n").trim();
  // Cut by code points, not UTF-16 units, so an emoji is never split in half.
  const chars = Array.from(text);
  return chars.length > 600 ? `${chars.slice(0, 600).join("")}…` : text;
}

export interface NewLeadAlertData {
  leadId: string;
  title: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  eventType: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  venue: string | null;
  assignedTo: string | null;
  receivedAt: Date;
  notes: string;
}

export function buildNewLeadAlert(d: NewLeadAlertData): { subject: string; html: string } {
  const sourceLabel = LEAD_SOURCE_LABELS[d.source] ?? d.source;
  const who = d.name || d.title;

  const rows: [string, string][] = [
    ["Name", d.name || "—"],
    ["Phone", d.phone || "—"],
    ["Email", d.email || "—"],
    ["Event", d.eventType || "—"],
    ["Event date", d.eventDate ? IST_DATE.format(d.eventDate) : "—"],
    ["Guests", d.guestCount ? String(d.guestCount) : "—"],
    ["Venue", d.venue || "—"],
    ["Source", sourceLabel],
    ["Assigned to", d.assignedTo || "Not assigned yet"],
    ["Received", `${IST_DATETIME.format(d.receivedAt)} IST`],
  ];

  const notes = d.notes
    ? `<p style="margin:16px 0 4px;color:#666;font-size:13px">Message / notes</p>
       <p style="margin:0;padding:10px 12px;background:#f4f6f5;border-radius:6px;font-size:14px;white-space:pre-wrap">${esc(d.notes)}</p>`
    : "";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#111">
      <h2 style="margin:0 0 4px;font-size:18px">New lead: ${esc(who)}</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px">${esc(sourceLabel)}${d.eventType ? ` · ${esc(d.eventType)}` : ""}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr>
                 <td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td>
                 <td style="padding:6px 0;font-weight:600">${esc(v)}</td>
               </tr>`
          )
          .join("")}
      </table>
      ${notes}
      <p style="margin:20px 0 0">
        <a href="${esc(appUrl(`/leads/${d.leadId}`))}"
           style="display:inline-block;background:#006742;color:#fff;text-decoration:none;
                  padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600">
          Open the lead in the CRM
        </a>
      </p>
      <p style="margin:16px 0 0;color:#888;font-size:12px">
        Sent automatically by the Veloria Grand CRM for every new lead.
      </p>
    </div>`;

  const subjectParts = [who, d.eventType, sourceLabel].filter(Boolean);
  return { subject: `New lead: ${subjectParts.join(" · ")}`, html };
}

export interface NewLeadAlertResult {
  sent: boolean;
  reason?: string;
}

/**
 * Send the alert email for one lead. Pure send: no bookkeeping. Returns a
 * result and never throws. `final: true` means retrying cannot help (the lead
 * is gone), as opposed to a mail failure worth trying again.
 */
export async function sendNewLeadAlert(
  leadId: string
): Promise<NewLeadAlertResult & { final?: boolean }> {
  try {
    const recipients = parseAlertRecipients(process.env.NEW_LEAD_ALERT_EMAILS);
    if (recipients.length === 0) return { sent: false, reason: "No alert recipients configured" };
    if (!isEmailConfigured()) return { sent: false, reason: "Email service not configured" };

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        title: true,
        description: true,
        source: true,
        eventType: true,
        eventDate: true,
        guestCount: true,
        createdAt: true,
        deletedAt: true,
        preferredVenue: { select: { name: true } },
        assignedTo: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
      },
    });
    if (!lead || lead.deletedAt) return { sent: false, reason: "Lead not found", final: true };

    const { subject, html } = buildNewLeadAlert({
      leadId: lead.id,
      title: lead.title,
      name: `${lead.contact?.firstName ?? ""} ${lead.contact?.lastName ?? ""}`.trim(),
      phone: lead.contact?.phone ?? null,
      email: lead.contact?.email ?? null,
      source: String(lead.source),
      eventType: lead.eventType,
      eventDate: lead.eventDate,
      guestCount: lead.guestCount,
      venue: lead.preferredVenue?.name ?? null,
      assignedTo: lead.assignedTo?.name ?? null,
      receivedAt: lead.createdAt,
      notes: cleanNotes(lead.description),
    });

    const res = await sendEmail({ to: recipients, subject, html });
    if (!res.success) {
      return { sent: false, reason: res.error || "Email provider rejected the message" };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

// ------------------------------------------------------------
// Durable delivery: a LeadAlertDelivery row per lead, retried until sent.
// ------------------------------------------------------------

/** How long one attempt may hold its claim before another worker may retry it. */
const CLAIM_MS = 3 * 60 * 1000;
/** Keep retrying for this long (covers a mail outage over a long weekend). */
const GIVE_UP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Minutes to wait after the Nth failed attempt: quick at first, then hourly. */
export function retryDelayMinutes(attempts: number): number {
  const steps = [1, 2, 5, 10, 15, 30];
  return attempts <= steps.length ? steps[Math.max(attempts, 1) - 1] : 60;
}

/**
 * Make one attempt on a delivery row, guarded by an atomic claim so two workers
 * (pm2 cluster, cron + request) can never send the same alert twice.
 * Returns "sent" | "retry" | "failed" | "skipped" (someone else holds it, or it is done).
 */
export async function attemptLeadAlertDelivery(
  deliveryId: string,
  now: Date = new Date()
): Promise<"sent" | "retry" | "failed" | "skipped"> {
  const claimed = await prisma.leadAlertDelivery.updateMany({
    where: {
      id: deliveryId,
      status: "PENDING",
      OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }],
    },
    data: { claimedUntil: new Date(now.getTime() + CLAIM_MS), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return "skipped";

  const row = await prisma.leadAlertDelivery.findUnique({ where: { id: deliveryId } });
  if (!row) return "skipped";

  const res = await sendNewLeadAlert(row.leadId);
  if (res.sent) {
    await prisma.leadAlertDelivery.update({
      where: { id: deliveryId },
      data: { status: "SENT", sentAt: new Date(), claimedUntil: null, lastError: null },
    });
    console.log("[NEW_LEAD_ALERT] sent", { leadId: row.leadId, attempts: row.attempts });
    return "sent";
  }

  const expired = now.getTime() - row.createdAt.getTime() > GIVE_UP_AFTER_MS;
  if (res.final || expired) {
    await prisma.leadAlertDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", claimedUntil: null, lastError: res.reason ?? null },
    });
    console.warn("[NEW_LEAD_ALERT] gave up", { leadId: row.leadId, reason: res.reason });
    if (!res.final) {
      await reportSystemFailure({
        area: "Lead alerts",
        title: "A new-lead alert email could not be sent",
        detail: `Gave up after ${row.attempts} attempts over 7 days: ${res.reason ?? "unknown error"}`,
        actionUrl: `/leads/${row.leadId}`,
      });
    }
    return "failed";
  }

  await prisma.leadAlertDelivery.update({
    where: { id: deliveryId },
    data: {
      claimedUntil: null,
      lastError: res.reason ?? null,
      nextAttemptAt: new Date(now.getTime() + retryDelayMinutes(row.attempts) * 60 * 1000),
    },
  });
  console.warn("[NEW_LEAD_ALERT] not sent, will retry", {
    leadId: row.leadId,
    attempts: row.attempts,
    reason: res.reason,
  });
  return "retry";
}

/**
 * Record that this lead is owed an alert, then try to send it straight away
 * without holding up the caller. Await this: the record is written before it
 * returns, so even if the send is cut short (a restart, a mail outage) the
 * 5-minute sweep finishes the job. Inert when no recipients are configured.
 * Never throws.
 */
export async function enqueueNewLeadAlert(leadId: string): Promise<void> {
  try {
    if (parseAlertRecipients(process.env.NEW_LEAD_ALERT_EMAILS).length === 0) return;
    const row = await prisma.leadAlertDelivery.upsert({
      where: { leadId },
      create: { leadId },
      update: {}, // already owed (or sent): never queue a second alert for one lead
      select: { id: true, status: true },
    });
    if (row.status !== "PENDING") return;
    void attemptLeadAlertDelivery(row.id).catch((e) =>
      console.error("[NEW_LEAD_ALERT] attempt failed", { leadId, e })
    );
  } catch (e) {
    console.error("[NEW_LEAD_ALERT] enqueue failed", { leadId, e });
  }
}

/**
 * The fast-lane sweep: retry every owed alert that is due. Oldest first, a
 * bounded batch per run so a backlog after a mail outage drains over a few
 * runs instead of one burst.
 */
export async function processDueLeadAlerts(
  limit = 20,
  budgetMs = 45_000
): Promise<{
  due: number;
  sent: number;
  retry: number;
  failed: number;
  deferred: number;
}> {
  const started = Date.now();
  const now = new Date();
  const due = await prisma.leadAlertDelivery.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const out = { due: due.length, sent: 0, retry: 0, failed: 0, deferred: 0 };
  for (const d of due) {
    // A slow mail server must not hold the fast lane: leave the rest for the
    // next run (they are still PENDING and due).
    if (Date.now() - started > budgetMs) {
      out.deferred++;
      continue;
    }
    const r = await attemptLeadAlertDelivery(d.id, new Date());
    if (r === "sent") out.sent++;
    else if (r === "retry") out.retry++;
    else if (r === "failed") out.failed++;
  }
  return out;
}
