// ============================================================
// The answers people actually gave on an ad's lead form.
// ------------------------------------------------------------
// Google and Meta both send the custom questions as a list of
// (column id, value) pairs, and both webhooks were reading five identity
// columns out of that list and dropping the rest on the floor. The result:
// 959 of 961 paid leads had no event date, so nobody could tell a wedding
// enquiry for next April from a tyre-kicker, and Qualified could never be
// judged from the data we already had.
//
// Matching is by meaning, not by exact id, because the column ids are whatever
// the person who built the form typed. Anything unrecognised is returned in
// `unmapped` so it can be logged and appended to the lead's notes — an answer
// we cannot file is still an answer the customer gave, and losing it silently
// is how we got here.
//
// Pure — no database, no network.
// ============================================================

export interface RawAnswer {
  /** Google's column_id, Meta's field name, or a question label. */
  key: string;
  value: string;
}

export interface MappedAnswers {
  eventDate: Date | null;
  guestCount: number | null;
  eventType: string | null;
  /** Answers no rule claimed — logged, and appended to the lead's notes. */
  unmapped: RawAnswer[];
}

const IDENTITY = /^(full_?name|first_?name|last_?name|name|email|e-?mail|phone|phone_?number|mobile|postal_?code|zip|city|company|company_?name|job_?title|street|address|country|state|consent|terms)$/i;

function norm(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** "wedding_ceremony_/_reception" → "Wedding Ceremony / Reception" */
export function prettifyAnswer(value: string): string {
  const cleaned = value.trim().replace(/_+/g, " ").replace(/\s*\/\s*/g, " / ").replace(/\s{2,}/g, " ");
  return cleaned
    .split(" ")
    .map((w) => (w === "/" ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .trim();
}

/**
 * Dates arrive as "2026-11-14", "14/11/2026", "14-11-2026" or "November 14,
 * 2026". Day-first is assumed for the ambiguous slash form, because these forms
 * are filled in India.
 */
export function parseAnswerDate(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return safeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return safeDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    // "November 14, 2026" parses as LOCAL midnight, so its UTC parts are the
    // 13th anywhere east of Greenwich — including on this team's own machines.
    // Read the local calendar parts and re-anchor them at UTC midnight, which
    // is how the app stores an event date.
    return safeDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return null;
}

function safeDate(y: number, m: number, d: number): Date | null {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** "150", "150 guests", "100-200", "approx 250" → a number. */
export function parseGuestCount(value: string): number | null {
  const nums = value.match(/\d+/g);
  if (!nums?.length) return null;
  // A range means the lower bound: quoting for the smaller number is the
  // conservative read, and it is what the guest-count rule should judge.
  const n = Number(nums[0]);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

/**
 * Sort a lead form's answers into the three fields that decide whether a lead
 * can be qualified.
 */
export function mapLeadFormAnswers(answers: RawAnswer[]): MappedAnswers {
  const out: MappedAnswers = {
    eventDate: null,
    guestCount: null,
    eventType: null,
    unmapped: [],
  };

  for (const answer of answers) {
    const key = norm(answer.key);
    const value = (answer.value ?? "").trim();
    if (!value) continue;
    if (IDENTITY.test(key)) continue; // handled by the webhook's own mapping

    if (!out.eventDate && /(event|function|wedding|party|celebration)?_?date|when|dob_?event|date_?of/.test(key)) {
      const d = parseAnswerDate(value);
      if (d) {
        out.eventDate = d;
        continue;
      }
    }

    if (out.guestCount == null && /(guest|pax|attendee|people|persons|headcount|no_?of|number_?of|capacity)/.test(key)) {
      const n = parseGuestCount(value);
      if (n != null) {
        out.guestCount = n;
        continue;
      }
    }

    if (!out.eventType && /(event|occasion|function|celebration|type|purpose|looking_?for|service)/.test(key)) {
      out.eventType = prettifyAnswer(value);
      continue;
    }

    out.unmapped.push({ key: answer.key, value });
  }

  return out;
}

/** A one-line note carrying the answers nothing claimed, for the lead's message. */
export function unmappedNote(unmapped: RawAnswer[]): string {
  if (!unmapped.length) return "";
  return unmapped.map((a) => `${prettifyAnswer(a.key)}: ${a.value}`).join(" · ");
}
