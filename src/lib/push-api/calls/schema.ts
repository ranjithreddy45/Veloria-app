import { z } from "zod";
import { exceedsDepth, normalizePushPhone } from "../leads/schema";

// ============================================================
// POST /api/v1/push/call-activity — what a pushed call may contain, and its
// one canonical form once validated.
//
// A call belongs to a lead, named by `lead_id` (our id) or `phone`. Unknown
// top-level fields are dropped. Free-form AI output goes in `ai_insights`,
// which is bounded in size and depth like a lead push's `metadata`.
// ============================================================

const MAX_INSIGHTS_BYTES = 8 * 1024;
const MAX_INSIGHTS_KEYS = 50;
const MAX_INSIGHTS_DEPTH = 3;
/** A call can't be timestamped further ahead than this (clock skew). */
const MAX_FUTURE_MS = 10 * 60_000;
/** Older calls are a backfill mistake, not activity on a live lead. */
const MAX_AGE_MS = 365 * 86_400_000;

const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");
const clean = (v: string) => v.replace(CONTROL_CHARS, "").trim();

const optionalText = (max: number) =>
  z
    .string({ message: "Must be a string" })
    .max(max, { message: `Must be at most ${max} characters` })
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return undefined;
      const t = clean(v);
      return t === "" ? undefined : t;
    });

/** An instant with an explicit zone: "2026-09-17T10:04:00Z" or "…+05:30". A zoneless time is ambiguous. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/;

export const CALL_STATUSES = ["completed", "no_answer", "busy", "voicemail", "wrong_number", "callback_requested"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

export const pushCallSchema = z
  .object({
    lead_id: optionalText(64),
    // Checked per field (not in the object-level refinement, which zod skips when any other field fails).
    phone: z
      .string({ message: "Invalid phone number" })
      .max(40, { message: "Invalid phone number" })
      .refine((v) => v.trim() === "" || normalizePushPhone(v) != null, {
        message: "Invalid phone number. Include the country code, e.g. +919876543210",
      })
      .optional()
      .nullable(),
    contact_name: optionalText(200),
    // Required: it is what makes a call impossible to record twice, across retries and the hourly import.
    external_call_id: z
      .string({ message: "Required" })
      .trim()
      .min(1, { message: "Required" })
      .max(200, { message: "Must be at most 200 characters" })
      .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/, { message: "Use letters, digits, _ . : - only" }),
    call_summary: z
      .string({ message: "Required" })
      .max(10_000, { message: "Must be at most 10000 characters" })
      .transform(clean)
      .refine((v) => v.length > 0, { message: "Required" }),
    sentiment: z.preprocess(lower, z.enum(["positive", "neutral", "negative"], { message: "Must be positive, neutral or negative" })).optional().nullable(),
    ai_score: z
      .number({ message: "Must be a whole number from 0 to 100" })
      .int({ message: "Must be a whole number from 0 to 100" })
      .min(0, { message: "Must be a whole number from 0 to 100" })
      .max(100, { message: "Must be a whole number from 0 to 100" })
      .optional()
      .nullable(),
    ai_insights: z
      .record(z.string(), z.unknown(), { message: "Must be a JSON object" })
      .optional()
      .nullable()
      .refine((v) => v == null || Object.keys(v).length <= MAX_INSIGHTS_KEYS, { message: `At most ${MAX_INSIGHTS_KEYS} keys` })
      .refine((v) => v == null || !exceedsDepth(v, MAX_INSIGHTS_DEPTH), { message: `Nested at most ${MAX_INSIGHTS_DEPTH} levels deep` })
      .refine((v) => v == null || Buffer.byteLength(JSON.stringify(v)) <= MAX_INSIGHTS_BYTES, { message: "Must be at most 8 KB" }),
    recording_url: z
      .string({ message: "Must be a URL" })
      .trim()
      .max(2000, { message: "Must be at most 2000 characters" })
      .refine(
        (v) => {
          try {
            return new URL(v).protocol === "https:";
          } catch {
            return false;
          }
        },
        { message: "Must be an https URL" }
      )
      .optional()
      .nullable(),
    agent_name: optionalText(200),
    agent_email: z.string({ message: "Invalid email address" }).trim().toLowerCase().email({ message: "Invalid email address" }).max(254).optional().nullable(),
    call_date: z
      .string({ message: "Required" })
      .trim()
      .regex(ISO_INSTANT, { message: "Must be an ISO 8601 date-time with a zone, e.g. 2026-09-17T10:04:00Z" })
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Must be a real date-time" })
      .refine((v) => Date.parse(v) <= Date.now() + MAX_FUTURE_MS, { message: "Can't be in the future" })
      .refine((v) => Date.parse(v) >= Date.now() - MAX_AGE_MS, { message: "Can't be more than a year ago" }),
    call_duration_seconds: z
      .number({ message: "Must be a whole number of seconds" })
      .int({ message: "Must be a whole number of seconds" })
      .min(0, { message: "Must be a whole number of seconds" })
      .max(86_400, { message: "Must be at most 86400" })
      .optional()
      .nullable(),
    action_items: z
      .array(z.string({ message: "Each item must be a string" }).max(500, { message: "Each item must be at most 500 characters" }), {
        message: "Must be an array of strings",
      })
      .max(50, { message: "At most 50 items" })
      .optional()
      .nullable(),
    direction: z.preprocess(lower, z.enum(["inbound", "outbound"], { message: "Must be inbound or outbound" })).optional().nullable(),
    call_status: z.preprocess(lower, z.enum(CALL_STATUSES, { message: `Must be one of ${CALL_STATUSES.join(", ")}` })).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    const hasPhone = v.phone != null && v.phone.trim() !== "";
    if (!v.lead_id && !hasPhone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Send lead_id or phone" });
    }
  });

export interface PushCall {
  leadId?: string;
  phone?: string;
  contactName?: string;
  externalCallId: string;
  summary: string;
  sentiment?: "positive" | "neutral" | "negative";
  aiScore?: number;
  aiInsights?: Record<string, unknown>;
  recordingUrl?: string;
  agentName?: string;
  agentEmail?: string;
  /** ISO instant, normalised to UTC. */
  callDate: string;
  durationSeconds: number;
  actionItems: string[];
  direction: "inbound" | "outbound";
  status: CallStatus;
}

export type ParsedPushCall = { ok: true; call: PushCall } | { ok: false; fields: Record<string, string> };

export function parsePushCall(body: unknown): ParsedPushCall {
  const result = pushCallSchema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length ? issue.path.map(String).join(".") : "body";
      if (!(key in fields)) fields[key] = issue.message;
    }
    return { ok: false, fields };
  }
  const v = result.data;
  return {
    ok: true,
    call: {
      leadId: v.lead_id,
      phone: v.phone != null && v.phone.trim() !== "" ? normalizePushPhone(v.phone)! : undefined,
      contactName: v.contact_name,
      externalCallId: v.external_call_id,
      summary: v.call_summary,
      sentiment: v.sentiment ?? undefined,
      aiScore: v.ai_score ?? undefined,
      aiInsights: v.ai_insights ?? undefined,
      recordingUrl: v.recording_url ?? undefined,
      agentName: v.agent_name,
      agentEmail: v.agent_email ?? undefined,
      callDate: new Date(v.call_date).toISOString(),
      durationSeconds: v.call_duration_seconds ?? 0,
      actionItems: (v.action_items ?? []).map(clean).filter(Boolean),
      direction: v.direction ?? "outbound",
      status: v.call_status ?? "completed",
    },
  };
}

export const PUSH_CALL_FIELDS = Object.keys(pushCallSchema.shape);
