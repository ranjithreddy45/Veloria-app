// Sample-project definitions for the "Load sample projects" admin tool. Plain data
// (no "use server") so it can be imported by the seed action. Each sample is tagged
// with SAMPLE_TAG (in the project notes) so the whole set can be removed cleanly.

export const SAMPLE_TAG = "[SAMPLE]";
export const SAMPLE_PREFIX = "Sample · ";

export interface DemoSnag {
  title: string; category: string; location: string; severity: "CRITICAL" | "MAJOR" | "MINOR";
  status: "OPEN" | "IN_PROGRESS" | "FIXED_PENDING_VERIFICATION" | "VERIFIED_CLOSED";
  description?: string;
}

export interface DemoSample {
  key: string;
  phase: "HANDOFF" | "ASSESSMENT" | "CAPEX" | "EXECUTION" | "OPS_AUDIT" | "HANDOVER" | "LIVE";
  propertyName: string;
  ownerName: string;
  ownerContact: string;
  city: string;
  locality: string;
  propertyType: "BANQUET" | "MARRIAGE_HALL" | "CONVENTION_CENTRE" | "RESORT" | "LAWN";
  fundingModel: "OWNER" | "VELORIA" | "SPLIT";
  hallCount: number;
  totalCapacity: number;
  totalSqft: number;
  readinessDonePct: number; // 0..100 — how much of the standards checklist is resolved
  hasDraftCapex?: boolean;
  hasApprovedCapex?: boolean;
  seedOpsAudit?: boolean; // instantiate the ops-audit checklist
  opsAuditAllPass?: boolean;
  snags: DemoSnag[];
  blurb: string; // shown nowhere yet; documents the intent of the sample
}

export const DEMO_SAMPLES: DemoSample[] = [
  {
    key: "handoff", phase: "HANDOFF",
    propertyName: SAMPLE_PREFIX + "Veloria Pearl, Whitefield",
    ownerName: "Rajesh Pearl Estates", ownerContact: "+91 98450 11001",
    city: "Bengaluru", locality: "Whitefield", propertyType: "BANQUET", fundingModel: "OWNER",
    hallCount: 2, totalCapacity: 600, totalSqft: 9000, readinessDonePct: 0,
    snags: [],
    blurb: "Freshly handed off from BD. Try: open it and click 'Accept handoff & start'.",
  },
  {
    key: "assessment", phase: "ASSESSMENT",
    propertyName: SAMPLE_PREFIX + "Veloria Sapphire, Indiranagar",
    ownerName: "Sapphire Hospitality LLP", ownerContact: "+91 98450 11002",
    city: "Bengaluru", locality: "Indiranagar", propertyType: "CONVENTION_CENTRE", fundingModel: "SPLIT",
    hallCount: 3, totalCapacity: 1200, totalSqft: 18000, readinessDonePct: 10,
    snags: [],
    blurb: "Scoping the venue vs Veloria standards. Try: 'Complete assessment & scoping'.",
  },
  {
    key: "capex", phase: "CAPEX",
    propertyName: SAMPLE_PREFIX + "Veloria Amber, Koramangala",
    ownerName: "Amber Greens Pvt Ltd", ownerContact: "+91 98450 11003",
    city: "Bengaluru", locality: "Koramangala", propertyType: "BANQUET", fundingModel: "OWNER",
    hallCount: 2, totalCapacity: 750, totalSqft: 11000, readinessDonePct: 20,
    hasDraftCapex: true,
    snags: [],
    blurb: "CapEx & timeline stage. Try: open the CapEx tab, approve the projection, record owner approval, then start execution.",
  },
  {
    key: "execution", phase: "EXECUTION",
    propertyName: SAMPLE_PREFIX + "Veloria Jade, Jayanagar",
    ownerName: "Jade Convention Co", ownerContact: "+91 98450 11004",
    city: "Bengaluru", locality: "Jayanagar", propertyType: "MARRIAGE_HALL", fundingModel: "OWNER",
    hallCount: 1, totalCapacity: 500, totalSqft: 7500, readinessDonePct: 62,
    hasApprovedCapex: true,
    snags: [
      { title: "Hairline crack in pre-function POP cornice", category: "Interiors", location: "Pre-function — north", severity: "MAJOR", status: "IN_PROGRESS", description: "Cornice cracked along the cove run; needs re-skim + repaint." },
      { title: "Emergency exit signage not illuminated", category: "Fire & Life Safety", location: "Hall A — rear exit", severity: "CRITICAL", status: "OPEN", description: "Exit sign dark — wiring not terminated." },
      { title: "Scuff marks on champagne PVD trim", category: "Interiors", location: "Lobby", severity: "MINOR", status: "FIXED_PENDING_VERIFICATION" },
    ],
    blurb: "Fit-out underway with live snags. Try: the Snags tab — start/fix snags, add before/after photos. The critical open snag blocks the ops-audit gate until fixed.",
  },
  {
    key: "opsaudit", phase: "OPS_AUDIT",
    propertyName: SAMPLE_PREFIX + "Veloria Onyx, Hebbal",
    ownerName: "Onyx Banquets", ownerContact: "+91 98450 11005",
    city: "Bengaluru", locality: "Hebbal", propertyType: "CONVENTION_CENTRE", fundingModel: "VELORIA",
    hallCount: 4, totalCapacity: 1800, totalSqft: 24000, readinessDonePct: 100,
    hasApprovedCapex: true, seedOpsAudit: true, opsAuditAllPass: false,
    snags: [
      { title: "Carpet seam lifting near stage", category: "Flooring & Carpet", location: "Hall B — stage", severity: "MAJOR", status: "FIXED_PENDING_VERIFICATION", description: "Seam re-glued; awaiting Ops verification with after-photo." },
    ],
    blurb: "Operations is running the deep audit. Try (as Operations): the Ops Audit tab — mark items PASS, verify the fixed snag (needs an after-photo), then sign off.",
  },
  {
    key: "handover", phase: "HANDOVER",
    propertyName: SAMPLE_PREFIX + "Veloria Coral, JP Nagar",
    ownerName: "Coral Celebrations", ownerContact: "+91 98450 11006",
    city: "Bengaluru", locality: "JP Nagar", propertyType: "BANQUET", fundingModel: "OWNER",
    hallCount: 2, totalCapacity: 900, totalSqft: 13000, readinessDonePct: 100,
    hasApprovedCapex: true, seedOpsAudit: true, opsAuditAllPass: true,
    snags: [
      { title: "Bridal lounge mirror alignment", category: "Interiors", location: "Bridal suite", severity: "MINOR", status: "VERIFIED_CLOSED" },
    ],
    blurb: "Audit passed, final go-ahead given, handover report submitted, Ops acknowledged. Try: Handover tab — acknowledge as Management, then Launch.",
  },
  {
    key: "live", phase: "LIVE",
    propertyName: SAMPLE_PREFIX + "Veloria Lumen, Sarjapur",
    ownerName: "Lumen Grand Estates", ownerContact: "+91 98450 11007",
    city: "Bengaluru", locality: "Sarjapur Road", propertyType: "RESORT", fundingModel: "SPLIT",
    hallCount: 5, totalCapacity: 2200, totalSqft: 32000, readinessDonePct: 100,
    hasApprovedCapex: true, seedOpsAudit: true, opsAuditAllPass: true,
    snags: [
      { title: "Lawn drainage low spot", category: "Exteriors & Entrance", location: "East lawn", severity: "MAJOR", status: "VERIFIED_CLOSED" },
    ],
    blurb: "Fully launched and handed to Operations & Sales — the finished state, with a complete sign-off trail.",
  },
];
