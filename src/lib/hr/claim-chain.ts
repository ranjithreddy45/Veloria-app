// ============================================================
// Reimbursement approval CHAINS — pure logic, client-safe.
// ------------------------------------------------------------
// A claim moves through an ordered list of stages, one at a time, and never
// skips one. Which list it gets is decided when it is submitted:
//
//   1. the claimant's own EMPLOYEE route   (e.g. Dilkash: HR → Venkat → Finance)
//   2. else the TEAM route of their reporting manager
//                                          (e.g. Dilkash's team: Manager → HR →
//                                           Venkat → Finance)
//   3. else the default rules              (configured 1st/2nd approvers, then
//                                           Finance)
//
// The resolved chain is snapshotted on the claim, so a claim keeps the route it
// was given even if someone changes teams halfway through.
//
// Nobody approves their own claim: a stage whose only approver is the claimant
// goes to the Super Admins instead (Amrutha's own final approval, for one).
// Only if literally nobody else could act does the claimant stay on it, so a
// claim can never be stuck with no approver.
// ============================================================

export const MAX_STAGES = 4;

export type RouteStage = { type: "MANAGER" } | { type: "USER"; userId: string } | { type: "FINANCE" };
export type RouteKind = "EMPLOYEE" | "TEAM";
export interface RouteRow {
  kind: RouteKind;
  subjectEmployeeId: string;
  stages: RouteStage[];
}

export type Person = { id: string; name: string | null; email: string };

export interface ChainStage {
  type: "MANAGER" | "USER" | "FINANCE" | "DEFAULT";
  /** "1st approval" … "Final approval". */
  label: string;
  /** Who this stage is, in words: "Reporting manager", "Finance", a name. */
  role: string;
  approverIds: string[];
  approverNames: string[];
  /** True when the configured approver could not act (no login, or is the claimant). */
  fallback: boolean;
  /** Filled in when this stage is approved; the snapshot doubles as the record. */
  decidedById?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  note?: string | null;
}

/** Status a claim carries while waiting at stage `index` (0-based). */
export const STAGE_STATUSES = ["PENDING", "PENDING_L2", "PENDING_L3", "PENDING_L4"] as const;

export function statusForStage(index: number): (typeof STAGE_STATUSES)[number] {
  return STAGE_STATUSES[Math.max(0, Math.min(STAGE_STATUSES.length - 1, index))];
}

export function stageForStatus(status: string): number | null {
  const i = (STAGE_STATUSES as readonly string[]).indexOf(status);
  return i === -1 ? null : i;
}

const ORDINAL = ["1st", "2nd", "3rd", "4th"];

/** "1st approval", "2nd approval", … with the last stage always "Final approval". */
export function stageLabel(index: number, total: number): string {
  if (total <= 1) return "Approval";
  if (index === total - 1) return "Final approval";
  return `${ORDINAL[index] ?? `${index + 1}th`} approval`;
}

/** Validate route stages read from JSON; anything malformed is dropped. */
export function parseRouteStages(raw: unknown): RouteStage[] {
  if (!Array.isArray(raw)) return [];
  const out: RouteStage[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const t = (s as { type?: unknown }).type;
    if (t === "MANAGER" || t === "FINANCE") out.push({ type: t });
    else if (t === "USER" && typeof (s as { userId?: unknown }).userId === "string" && (s as { userId: string }).userId)
      out.push({ type: "USER", userId: (s as { userId: string }).userId });
  }
  return out.slice(0, MAX_STAGES);
}

/** Read a snapshotted chain back from JSON. */
export function parseChain(raw: unknown): ChainStage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ChainStage[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") return null;
    const c = s as Partial<ChainStage>;
    if (!Array.isArray(c.approverIds) || typeof c.label !== "string") return null;
    out.push({
      type: (c.type as ChainStage["type"]) ?? "DEFAULT",
      label: c.label,
      role: typeof c.role === "string" ? c.role : c.label,
      approverIds: c.approverIds.filter((x): x is string => typeof x === "string"),
      approverNames: Array.isArray(c.approverNames) ? c.approverNames.filter((x): x is string => typeof x === "string") : [],
      fallback: !!c.fallback,
      decidedById: typeof c.decidedById === "string" ? c.decidedById : null,
      decidedByName: typeof c.decidedByName === "string" ? c.decidedByName : null,
      decidedAt: typeof c.decidedAt === "string" ? c.decidedAt : null,
      note: typeof c.note === "string" ? c.note : null,
    });
  }
  return out;
}

/** The route that applies to an employee: their own first, then their manager's team route. */
export function pickRoute(
  routes: RouteRow[],
  employee: { id: string; reportingManagerId: string | null },
): RouteRow | null {
  const own = routes.find((r) => r.kind === "EMPLOYEE" && r.subjectEmployeeId === employee.id);
  if (own && own.stages.length) return own;
  if (employee.reportingManagerId) {
    const team = routes.find((r) => r.kind === "TEAM" && r.subjectEmployeeId === employee.reportingManagerId);
    if (team && team.stages.length) return team;
  }
  return null;
}

export interface StageSpec {
  type: ChainStage["type"];
  role: string;
  /** Who is configured for this stage, before the self-approval rule. */
  candidates: Person[];
}

const nameOf = (p: Person) => p.name ?? p.email;

/**
 * Turn stage specs into a chain, applying the self-approval rule. A stage's
 * approvers are its candidates minus the claimant. If that leaves nobody, the
 * Super Admins minus the claimant AND minus anyone who approves another stage
 * of this chain (so one person never holds two of a claim's approvals); then
 * the Super Admins minus the claimant; and only then the candidates as they
 * are, so the claim is never stranded.
 */
export function buildChain(specs: StageSpec[], ctx: { claimantUserId: string | null; superAdmins: Person[] }): ChainStage[] {
  const used = specs.slice(0, MAX_STAGES);
  const total = used.length;
  const notClaimant = (p: Person) => p.id !== ctx.claimantUserId;
  const primary = used.map((spec) => spec.candidates.filter(notClaimant));
  return used.map((spec, i) => {
    let people = primary[i];
    let fallback = false;
    if (people.length === 0) {
      const elsewhere = new Set(primary.flatMap((ps, j) => (j === i ? [] : ps.map((p) => p.id))));
      people = ctx.superAdmins.filter((p) => notClaimant(p) && !elsewhere.has(p.id));
      if (people.length === 0) people = ctx.superAdmins.filter(notClaimant);
      fallback = true;
    }
    if (people.length === 0) {
      people = spec.candidates.length ? spec.candidates : ctx.superAdmins;
      fallback = true;
    }
    return {
      type: spec.type,
      label: stageLabel(i, total),
      role: fallback ? `${spec.role} → Super Admin` : spec.role,
      approverIds: people.map((p) => p.id),
      approverNames: people.map(nameOf),
      fallback,
    };
  });
}

/**
 * Who may act at stage `idx` now: its approvers minus anyone who already gave
 * an earlier approval on this claim — so one person never gives two — unless
 * that leaves nobody, in which case its approvers as they are (a claim must
 * never be stranded). The claimant is already kept out by buildChain.
 */
export function eligibleApproverIds(chain: ChainStage[], idx: number): string[] {
  const stage = chain[idx];
  if (!stage) return [];
  const earlier = new Set(chain.slice(0, idx).flatMap((st) => (st.decidedById ? [st.decidedById] : [])));
  const eligible = stage.approverIds.filter((id) => !earlier.has(id));
  return eligible.length ? eligible : stage.approverIds;
}

/** Stage `idx` narrowed to the approvers who may act on it now (for queues, notices, "with …"). */
export function eligibleStage(chain: ChainStage[], idx: number): ChainStage | undefined {
  const stage = chain[idx];
  if (!stage) return undefined;
  const ids = eligibleApproverIds(chain, idx);
  const names = stage.approverIds.flatMap((id, i) => (ids.includes(id) ? [stage.approverNames[i] ?? id] : []));
  return { ...stage, approverIds: ids, approverNames: names };
}

/** "Venkat" or "Venkat / Ranjith". */
export function stageHolder(stage: ChainStage | undefined): string {
  return stage?.approverNames.join(" / ") || "the approver";
}

/** "Dilkash → Meghana → Venkat → Amrutha", for the trail and notifications. */
export function chainSummary(chain: ChainStage[]): string {
  return chain.map((s) => stageHolder(s)).join(" → ");
}
