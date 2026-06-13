// Projects pipeline — 9-stage machine (plain module, safe on client + server).
//
// Stored on AcqOnboardingProject.phase as a plain string. The stage list below is
// canonical; legacy values from the earlier 6-phase build are mapped through
// normalizePhase() at every boundary, so no data migration is required.

export const PROJECT_PHASES = [
  "HANDOFF",
  "ASSESSMENT",
  "CAPEX",
  "EXECUTION",
  "INTERNAL_QC",
  "OPS_AUDIT",
  "FINAL_GO_AHEAD",
  "HANDOVER",
  "LIVE",
] as const;

export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const PROJECT_PHASE_LABEL: Record<string, string> = {
  HANDOFF: "Handoff Received",
  ASSESSMENT: "Assessment & Scoping",
  CAPEX: "CapEx & Timeline",
  EXECUTION: "Execution / Fit-out",
  INTERNAL_QC: "Internal QC",
  OPS_AUDIT: "Operations Audit",
  FINAL_GO_AHEAD: "Final Go-Ahead",
  HANDOVER: "Handover & Launch",
  LIVE: "Live / Handed Over",
};

// Short blurb shown under each stage in the stepper.
export const PROJECT_PHASE_HINT: Record<string, string> = {
  HANDOFF: "PM accepts the closed deal; venue master data captured.",
  ASSESSMENT: "Site survey vs Veloria standards; gap list built.",
  CAPEX: "Run the calculator; Head approves the model; owner approval recorded.",
  EXECUTION: "Vendors, work packages, photos, % progress.",
  INTERNAL_QC: "PM self-audit; snags cleared; no open critical/major defects.",
  OPS_AUDIT: "Operations runs the deep audit; every snag verified-closed.",
  FINAL_GO_AHEAD: "Projects Head gives the launch go-ahead.",
  HANDOVER: "Handover report submitted; Ops + Management acknowledge.",
  LIVE: "Venue is live; Marketing & Sales notified; Ops owns operations.",
};

// Legacy 6-phase values → canonical 9-stage values.
const LEGACY_PHASE_MAP: Record<string, ProjectPhase> = {
  PLANNING: "ASSESSMENT",
  LAUNCHED: "LIVE",
  // CAPEX / EXECUTION / OPS_AUDIT / HANDOVER keep their names.
};

export function normalizePhase(stored: string | null | undefined): ProjectPhase {
  if (!stored) return "HANDOFF";
  if ((PROJECT_PHASES as readonly string[]).includes(stored)) return stored as ProjectPhase;
  return LEGACY_PHASE_MAP[stored] ?? "HANDOFF";
}

export function phaseIndex(stored: string | null | undefined): number {
  return PROJECT_PHASES.indexOf(normalizePhase(stored));
}

// Every stored string that normalises to the given canonical stage (the stage
// itself plus any legacy aliases). Used to scope atomic phase-transition writes
// so legacy-valued rows still match.
export function phaseMatchValues(canonical: ProjectPhase): string[] {
  const legacy = Object.entries(LEGACY_PHASE_MAP)
    .filter(([, v]) => v === canonical)
    .map(([k]) => k);
  return [canonical, ...legacy];
}

// Stages a PM can move between freely via the dropdown. The remaining stages are
// gated and reachable only through their workflow actions (advance/approve/audit/
// handover/launch), each of which enforces its own exit criteria server-side.
export const MANUAL_PHASES: ProjectPhase[] = ["HANDOFF", "ASSESSMENT", "EXECUTION"];

export function isManualPhase(stored: string | null | undefined): boolean {
  return MANUAL_PHASES.includes(normalizePhase(stored));
}
