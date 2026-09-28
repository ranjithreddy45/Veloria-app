// ============================================================
// The rows Google Ads fetches once a day.
// ------------------------------------------------------------
// Google only optimises toward what we send back. Until now it received form
// submissions and nothing else, so it bid for whoever filled a form fastest:
// 346 Google Ads leads, none of them ever won. This feed closes the loop by
// telling Google which clicks became a qualified conversation and which became
// a booking, with the booking's real rupee value.
//
// Format is Google's offline-conversion import, which is fussy and unforgiving:
// a leading Parameters:TimeZone line, an exact header row, times as
// yyyy-MM-dd HH:mm:ss in that timezone, and the conversion name matching the
// conversion action in the account CHARACTER FOR CHARACTER. A mismatch there is
// silent — Google accepts the file and drops every row.
//
// Pure — no database, no request. The route feeds it rows and writes the audit.
// ============================================================

/** Must match the conversion actions in Google Ads exactly. */
export const QUALIFIED_CONVERSION = "CRM - Qualified lead";
export const WON_CONVERSION = "CRM - Booking (Won)";

/** A qualified conversation is worth a flat ₹5,000 to the bidding model. */
export const QUALIFIED_VALUE = 5000;

/** Google's name for IST in this file format. */
export const FEED_TIMEZONE = "Asia/Calcutta";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FeedLead {
  id: string;
  createdAt: Date;
  qualifiedAt: Date | null;
  wonAt: Date | null;
  bookingValue: number | null;
  /** Raw click id, exactly as Google gave it. Empty means the lead is skipped. */
  gclid: string | null;
}

export interface ConversionRow {
  leadId: string;
  clickId: string;
  conversionName: string;
  /** The instant, in UTC. Rendered into IST only at the last moment. */
  conversionTime: Date;
  value: number;
  currency: "INR";
}

/**
 * `yyyy-MM-dd HH:mm:ss` in IST.
 *
 * Done by shifting the instant and reading its UTC parts rather than with
 * toLocaleString, because the server runs on UTC and a locale-formatted string
 * is at the mercy of the runtime's ICU data. This is arithmetic, and it is the
 * same on every machine.
 */
export function formatIst(instant: Date): string {
  const t = new Date(instant.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ` +
    `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`
  );
}

export interface FeedOptions {
  now?: Date;
  /** How far back to list. Re-listing is safe: Google skips exact duplicates. */
  windowDays?: number;
  /** Google refuses a conversion more than this long after its click. */
  maxAgeDays?: number;
}

/**
 * Turn leads into conversion rows, dropping everything Google would reject.
 *
 * The four filters are not defensive padding; each one is a row Google would
 * either refuse or, worse, accept and attribute wrongly:
 *   • no click id      — nothing to attribute the conversion to
 *   • in the future    — rejected outright
 *   • before the lead  — a conversion cannot precede its own click
 *   • older than 90d   — outside Google's attribution window
 */
export function buildConversionRows(leads: FeedLead[], options: FeedOptions = {}): ConversionRow[] {
  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - (options.windowDays ?? 30) * DAY_MS);
  const maxAgeDays = options.maxAgeDays ?? 90;
  const rows: ConversionRow[] = [];

  for (const lead of leads) {
    const clickId = (lead.gclid ?? "").trim();
    if (!clickId) continue;

    const candidates: { name: string; at: Date | null; value: number }[] = [
      { name: QUALIFIED_CONVERSION, at: lead.qualifiedAt, value: QUALIFIED_VALUE },
      { name: WON_CONVERSION, at: lead.wonAt, value: Number(lead.bookingValue ?? 0) },
    ];

    for (const candidate of candidates) {
      if (!candidate.at) continue;
      const at = candidate.at;
      if (at < windowStart) continue; // outside the listing window
      if (at.getTime() > now.getTime()) continue; // in the future
      if (at.getTime() < lead.createdAt.getTime()) continue; // before its own click
      if (at.getTime() - lead.createdAt.getTime() > maxAgeDays * DAY_MS) continue; // too late
      // A Won row with no value would tell Google a booking was worth nothing.
      if (candidate.name === WON_CONVERSION && !(candidate.value > 0)) continue;

      rows.push({
        leadId: lead.id,
        clickId,
        conversionName: candidate.name,
        conversionTime: at,
        value: candidate.value,
        currency: "INR",
      });
    }
  }

  // Oldest first: if Google ever truncates a file, the newest conversions are
  // the ones it has not seen before, so they should be last to be dropped.
  return rows.sort((a, b) => a.conversionTime.getTime() - b.conversionTime.getTime());
}

/** One CSV field, quoted only when it has to be. */
function esc(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The exact file Google expects: the timezone parameter line, the header, then
 * the rows. No blank lines, because a blank line aborts Google's parse.
 */
export function toFeedCsv(rows: ConversionRow[]): string {
  const lines = [
    `Parameters:TimeZone=${FEED_TIMEZONE}`,
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
    ...rows.map((r) =>
      [
        esc(r.clickId),
        esc(r.conversionName),
        esc(formatIst(r.conversionTime)),
        String(Math.round(r.value)),
        r.currency,
      ].join(",")
    ),
  ];
  return lines.join("\n") + "\n";
}
