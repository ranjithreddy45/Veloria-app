// ============================================================
// Call insights for ONE lead — pure.
// ------------------------------------------------------------
// Every call CallVibe pushes (src/lib/push-api/calls/record.ts) is a CallLog
// with a Communication whose metadata carries the AI read of the call: a
// summary, action items, a score and free-form `aiInsights` (booking stage,
// category, guest count, budget, date flexibility, location…). Until now that
// lived only on the Engagement → Call Log page. This turns a lead's calls into
// what the lead page shows: a headline (how many calls, connected or not, talk
// time, last call), "what we learned on calls" (the newest answer for each
// insight, with the call it came from), open action items, and each call.
//
// Pure: no database, `now` never read — the caller passes rows in.
// ============================================================

export interface LeadCallRow {
  id: string;
  createdAt: Date | string;
  disposition: string;
  durationSeconds: number;
  recordingUrl: string | null;
  notes: string | null;
  agentName: string | null;
  direction: string | null;
  content: string | null;
  metadata: unknown;
}

export interface CallFact {
  key: string;
  label: string;
  value: string;
  /** When the call that said it happened. */
  at: string;
}

export interface LeadCall {
  id: string;
  at: string;
  disposition: string;
  connected: boolean;
  durationSeconds: number;
  recordingUrl: string | null;
  agentName: string | null;
  direction: string | null;
  summary: string | null;
  score: { value: number; outOf: number } | null;
  actionItems: string[];
  insights: { label: string; value: string }[];
  /** The raw metadata, for the full-insights dialog (transcript, chapters…). */
  metadata: Record<string, unknown> | null;
}

export interface LeadCallInsights {
  total: number;
  connected: number;
  notConnected: number;
  talkSeconds: number;
  lastCallAt: string | null;
  lastConnectedAt: string | null;
  latestScore: { value: number; outOf: number; at: string } | null;
  facts: CallFact[];
  /** Action items from the most recent connected call that had any. */
  openActionItems: { items: string[]; at: string } | null;
  calls: LeadCall[];
}

/** The insight keys we know, in the order a salesperson reads them. */
const KNOWN_FACTS: [string, string][] = [
  ["booking_stage", "Booking stage"],
  ["category", "Enquiry about"],
  ["guest_count", "Guests"],
  ["budget_classification", "Budget"],
  ["event_date_flexibility", "Event date"],
  ["location", "Location"],
];

/** Quality bookkeeping, shown as one "Call quality" line rather than three. */
const QUALITY_KEYS = new Set(["opening_quality", "quality_fields_counted", "quality_max"]);

/** "Not discussed" and the like say nothing; they must not hide an older real answer. */
const EMPTY_ANSWER = /^(not\s+(discussed|applicable|mentioned|available|specified)|n\/?a|none|unknown|-+|null)$/i;

// A voicemail is not a conversation; a callback request is (someone picked up).
const CONNECTED = new Set(["COMPLETED", "CALLBACK_REQUESTED"]);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    const parts = v.map(text).filter((x): x is string => !!x);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function prettyKey(k: string): string {
  return k.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());
}

function iso(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString();
}

/**
 * The score on its real scale. The push contract says 0–100, but CallVibe
 * sends 0–10 in practice (and its quality_max is 10) — so a score is "out of
 * 10" unless it is above 10.
 */
export function scoreOf(meta: Record<string, unknown> | null): { value: number; outOf: number } | null {
  const raw = meta?.aiScore;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return { value: n, outOf: n > 10 ? 100 : 10 };
}

function actionItemsOf(meta: Record<string, unknown> | null): string[] {
  const a = meta?.actionItems;
  if (Array.isArray(a)) return a.map(text).filter((x): x is string => !!x);
  const t = text(a);
  return t ? [t] : [];
}

function insightsOf(meta: Record<string, unknown> | null): { label: string; value: string }[] {
  const ins = asRecord(meta?.aiInsights);
  if (!ins) return [];
  const out: { label: string; value: string }[] = [];
  const known = new Set(KNOWN_FACTS.map(([k]) => k));
  for (const [k, label] of KNOWN_FACTS) {
    const v = text(ins[k]);
    if (v) out.push({ label, value: v });
  }
  const q = text(ins.quality_fields_counted);
  const max = text(ins.quality_max);
  if (q && max) out.push({ label: "Call quality", value: `${q} of ${max} details captured` });
  for (const [k, v] of Object.entries(ins)) {
    if (known.has(k) || QUALITY_KEYS.has(k)) continue;
    const t = text(v);
    if (t) out.push({ label: prettyKey(k), value: t });
  }
  return out;
}

/** Calls newest first, each with its AI read laid out; plus the lead-level headline. */
export function summariseLeadCalls(rows: LeadCallRow[]): LeadCallInsights {
  const calls: LeadCall[] = rows
    .map((r) => {
      const meta = asRecord(r.metadata);
      return {
        id: r.id,
        at: iso(r.createdAt),
        disposition: r.disposition,
        connected: CONNECTED.has(r.disposition),
        durationSeconds: Math.max(0, r.durationSeconds || 0),
        recordingUrl: r.recordingUrl,
        agentName: r.agentName ?? text(meta?.agentName),
        direction: r.direction,
        summary: text(r.content) ?? text(meta?.summary) ?? text(r.notes),
        score: scoreOf(meta),
        actionItems: actionItemsOf(meta),
        insights: insightsOf(meta),
        metadata: meta,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  const connected = calls.filter((c) => c.connected);

  // Newest real answer per known insight.
  const facts: CallFact[] = [];
  for (const [key, label] of KNOWN_FACTS) {
    for (const c of calls) {
      const v = text(asRecord(c.metadata?.aiInsights)?.[key]);
      if (v && !EMPTY_ANSWER.test(v)) {
        facts.push({ key, label, value: v, at: c.at });
        break;
      }
    }
  }

  const scored = calls.find((c) => c.score);
  const withActions = calls.find((c) => c.actionItems.length > 0);

  return {
    total: calls.length,
    connected: connected.length,
    notConnected: calls.length - connected.length,
    talkSeconds: calls.reduce((s, c) => s + c.durationSeconds, 0),
    lastCallAt: calls[0]?.at ?? null,
    lastConnectedAt: connected[0]?.at ?? null,
    latestScore: scored?.score ? { ...scored.score, at: scored.at } : null,
    facts,
    openActionItems: withActions ? { items: withActions.actionItems, at: withActions.at } : null,
    calls,
  };
}

/** "4m 05s", "45s", "1h 02m". */
export function formatTalkTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

/** "21 Oct, 11:34 am" on the India clock, whatever timezone the server runs in. */
export function formatIstDateTime(at: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(at));
}
