// ============================================================
// One rule for what a phone number looks like.
//
// It was private to lead-capture.ts, so only the two paths that imported it —
// capture and CSV import — produced canonical numbers. Manual contact creation,
// the public configurator, the public hold flow and the widget all stored
// whatever was typed. The database therefore holds a mixture:
//
//   +919008123456   (capture, import)
//   9008123456      (typed by a rep)
//   98765 43210     (typed with a space)
//   09008123456     (typed with a trunk zero)
//
// Which is invisible in the app, because every screen just prints the string —
// and very visible in a CSV, because a spreadsheet TYPES each cell. "+91…"
// stays text; a bare run of digits becomes a number, loses its leading zero,
// and at twelve digits renders as 9.19008E+11.
//
// So the export normalises rather than trusting the stored value. It does NOT
// rewrite the database: that is a separate decision about historical data, and
// a display fix should not quietly mutate records.
// ============================================================

/**
 * Canonical form: `+<country><number>`, digits only after the plus.
 *
 * Returns the input trimmed when there is nothing numeric to work with, and
 * returns a bare local number when the country cannot be inferred — guessing a
 * country code onto an unrecognised number would invent data.
 */
export function canonicalPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  // 1. Explicit international form — trust it.
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;

  const local = digits.replace(/^0+/, "");
  // 2. Indian mobile: exactly 10 digits, first digit 6-9.
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  // 12 digits already country-coded as 91.
  if (local.length === 12 && local.startsWith("91")) return `+${local}`;
  // 3. Unknown country — keep what we were given rather than guess.
  return local;
}

/**
 * A phone number as it should appear in an exported spreadsheet.
 *
 * The leading "+" is doing real work: it is what stops Excel and Google Sheets
 * parsing the cell as a number. A number loses any leading zero and, past
 * eleven digits, is displayed in scientific notation — so the column silently
 * becomes useless for the one thing it is for, which is dialling.
 *
 * Where a country cannot be inferred the digits are returned bare and the
 * spreadsheet may still coerce them. That is preferable to prefixing "+91" onto
 * a number that may not be Indian: a wrong number is worse than an awkward one.
 */
export function phoneForExport(raw: string | null | undefined): string {
  if (!raw) return "";
  const canonical = canonicalPhone(String(raw));
  return canonical;
}
