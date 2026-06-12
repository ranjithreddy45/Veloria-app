// Projects pipeline phases (plain module — safe to import from client + server).
export const PROJECT_PHASES = ["PLANNING", "CAPEX", "EXECUTION", "OPS_AUDIT", "HANDOVER", "LAUNCHED"] as const;

export const PROJECT_PHASE_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  CAPEX: "CapEx & Owner Sign-off",
  EXECUTION: "Execution",
  OPS_AUDIT: "Operations Audit",
  HANDOVER: "Handover",
  LAUNCHED: "Launched",
};
