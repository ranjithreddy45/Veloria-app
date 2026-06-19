/**
 * Critical-to-Quality (CTQ) catalog — pure data, no imports.
 * Six fixed metrics spanning the operational value chain.
 */

export interface CtqDefinition {
  id: string;
  label: string;
  domain: string;
  unitNoun: string;
}

export const CTQ_CATALOG: CtqDefinition[] = [
  {
    id: "lead-sla",
    label: "Lead response SLA",
    domain: "Sales",
    unitNoun: "leads",
  },
  {
    id: "payment-punctuality",
    label: "Payment punctuality",
    domain: "Finance",
    unitNoun: "instalments",
  },
  {
    id: "task-on-time",
    label: "Ops task on-time",
    domain: "Operations",
    unitNoun: "tasks",
  },
  {
    id: "support-sla",
    label: "Support SLA",
    domain: "Customer",
    unitNoun: "tickets",
  },
  {
    id: "handover-snag",
    label: "Snag-free handover",
    domain: "Delivery",
    unitNoun: "handovers",
  },
  {
    id: "cx-rating",
    label: "Guest satisfaction",
    domain: "Customer",
    unitNoun: "ratings",
  },
];
