// ============================================================
// Finance — bank import + learning reconciliation matcher (W4).
// Pure, testable logic: parse a bank-statement CSV, build a stable dedupe key,
// score candidate matches between bank lines and posted GL entries on the bank
// account, and apply learned categorization rules. All money compared in
// integer paise (never float).
// ============================================================

export interface BankRow {
  date: Date;
  description: string;
  reference: string | null;
  debit: number; // money OUT of the bank (rupees)
  credit: number; // money INTO the bank (rupees)
}

const paise = (n: number) => Math.round((n ?? 0) * 100);

// Parse "1,23,456.78" / "(500.00)" / "" → number (rupees). Parens = negative.
export function parseAmount(s: string | undefined | null): number {
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s.trim());
  const cleaned = s.replace(/[(),₹\s]/g, "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  if (!isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

// Split a CSV line respecting double-quoted fields.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function findCol(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (patterns.some((p) => p.test(headers[i]))) return i;
  }
  return -1;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  // dd/mm/yyyy or dd-mm-yyyy (common in Indian bank exports)
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    const date = new Date(Date.UTC(+yy, +mo - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  }
  // ISO yyyy-mm-dd
  const iso = new Date(t.length <= 10 ? t + "T00:00:00.000Z" : t);
  return isNaN(iso.getTime()) ? null : iso;
}

/**
 * Parse a bank-statement CSV into normalized rows. Tolerant of header naming:
 * date / description (narration/particulars) / debit (withdrawal) / credit
 * (deposit) / amount (signed) / reference (chq/utr). Lines that don't parse to
 * a date + a non-zero amount are skipped.
 */
export function parseBankCsv(text: string): { rows: BankRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0 };
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());

  const cDate = findCol(headers, [/date|txn date|value date/]);
  const cDesc = findCol(headers, [/desc|narration|particular|remark|detail/]);
  const cDebit = findCol(headers, [/debit|withdrawal|withdraw/]);
  const cCredit = findCol(headers, [/credit|deposit/]);
  const cAmount = findCol(headers, [/^amount$|amt/]);
  const cRef = findCol(headers, [/ref|chq|cheque|utr|transaction id/]);

  const rows: BankRow[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const date = parseDate(cols[cDate] ?? "");
    const description = (cDesc >= 0 ? cols[cDesc] : "") || "(no description)";
    let debit = 0, credit = 0;
    if (cDebit >= 0 || cCredit >= 0) {
      debit = Math.abs(parseAmount(cols[cDebit]));
      credit = Math.abs(parseAmount(cols[cCredit]));
    } else if (cAmount >= 0) {
      const amt = parseAmount(cols[cAmount]);
      if (amt >= 0) credit = amt; else debit = Math.abs(amt);
    }
    if (!date || (paise(debit) === 0 && paise(credit) === 0)) { skipped++; continue; }
    rows.push({ date, description, reference: cRef >= 0 ? (cols[cRef] || null) : null, debit, credit });
  }
  return { rows, skipped };
}

// Stable, human-readable dedupe key so re-importing the same statement is a
// no-op (enforced by a unique index on (bankAccountId, dedupeHash)).
export function dedupeKey(row: BankRow): string {
  const d = row.date.toISOString().slice(0, 10);
  const key = `${d}|${row.description.toLowerCase().replace(/\s+/g, " ").trim()}|${paise(row.debit)}|${paise(row.credit)}|${(row.reference ?? "").toLowerCase()}`;
  return key.slice(0, 300);
}

export interface MatchCandidate {
  entryId: string;
  date: Date;
  bankDebit: number; // the JE's debit to the bank account (money in)
  bankCredit: number; // the JE's credit to the bank account (money out)
}

/**
 * Score a bank line against a candidate GL entry's bank-account line.
 *  - money INTO the bank (txn.credit) should match the entry's bank DEBIT
 *  - money OUT of the bank (txn.debit) should match the entry's bank CREDIT
 * Amount must match exactly (paise); date proximity refines the score.
 * Returns 0 when the amount/direction don't match.
 */
export function scoreMatch(txn: BankRow, cand: MatchCandidate, windowDays = 7): number {
  const inMatch = paise(txn.credit) > 0 && paise(txn.credit) === paise(cand.bankDebit);
  const outMatch = paise(txn.debit) > 0 && paise(txn.debit) === paise(cand.bankCredit);
  if (!inMatch && !outMatch) return 0;
  const days = Math.abs((txn.date.getTime() - cand.date.getTime()) / 86_400_000);
  if (days > windowDays) return 0;
  const dateScore = 1 - days / windowDays; // 1.0 same day → 0 at the window edge
  return 0.6 + 0.4 * dateScore;
}

/**
 * Greedy 1:1 suggestion — each txn takes its highest-scoring still-free
 * candidate above the threshold. Returns a map txnIndex → entryId.
 */
export function suggestMatches(
  txns: BankRow[],
  candidates: MatchCandidate[],
  opts?: { windowDays?: number; threshold?: number },
): Map<number, { entryId: string; score: number }> {
  const windowDays = opts?.windowDays ?? 7;
  const threshold = opts?.threshold ?? 0.6;
  const taken = new Set<string>();
  const result = new Map<number, { entryId: string; score: number }>();
  // Process txns by date for deterministic, stable assignment.
  const order = txns.map((_, i) => i).sort((a, b) => txns[a].date.getTime() - txns[b].date.getTime());
  for (const i of order) {
    let best: { entryId: string; score: number } | null = null;
    for (const cand of candidates) {
      if (taken.has(cand.entryId)) continue;
      const score = scoreMatch(txns[i], cand, windowDays);
      if (score >= threshold && (!best || score > best.score)) best = { entryId: cand.entryId, score };
    }
    if (best) { taken.add(best.entryId); result.set(i, best); }
  }
  return result;
}

// ---- Learned categorization rules ----
export interface ReconRule { id: string; match: string; accountId: string; direction: string | null; hits: number }

// Pick the best rule whose lowercased `match` is contained in the description
// and whose direction is compatible. Highest hits wins; longer match breaks ties.
export function applyRules(description: string, direction: "CREDIT" | "DEBIT", rules: ReconRule[]): ReconRule | null {
  const desc = description.toLowerCase();
  let best: ReconRule | null = null;
  for (const r of rules) {
    if (!r.match || !desc.includes(r.match)) continue;
    if (r.direction && r.direction !== direction) continue;
    if (!best || r.hits > best.hits || (r.hits === best.hits && r.match.length > best.match.length)) best = r;
  }
  return best;
}

// Derive a salient lowercase token to store as a learned rule from a description
// (drop digits/punctuation, keep the longest alphabetic word ≥4 chars).
export function ruleTokenFor(description: string): string {
  const words = description.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
  if (words.length === 0) return description.toLowerCase().slice(0, 24).trim();
  return words.sort((a, b) => b.length - a.length)[0];
}
