import { cn } from "@/lib/utils";

// ============================================================
// StatusPill — Linear-style semantic colored chip
// ----------------------------------------------------------------
// Tint background + saturated dot + colored text.
// Hue is the *single source of truth* — derived from the color
// token. Lets you pass any tailwind color name (emerald, amber...).
// ============================================================

export type Hue =
  | "slate"
  | "indigo"
  | "blue"
  | "sky"
  | "cyan"
  | "teal"
  | "emerald"
  | "amber"
  | "orange"
  | "rose"
  | "red"
  | "violet"
  | "purple"
  | "pink"
  | "neutral";

type Size = "xs" | "sm";

interface StatusPillProps {
  label: string;
  hue?: Hue;
  size?: Size;
  /** Hide the leading dot — useful when the label itself is short. */
  noDot?: boolean;
  className?: string;
}

// Tailwind needs full classnames at build time, so we map explicitly. Each hue
// carries a dark variant (dark bg tint + light text + dark ring) — without it,
// a light-50 tint sat under theme-light text in dark mode and every pill went
// invisible (SC-02).
const HUE_CLASSES: Record<Hue, { bg: string; text: string; ring: string; dot: string }> = {
  slate:   { bg: "bg-slate-50 dark:bg-slate-800/50",     text: "text-slate-700 dark:text-slate-300",     ring: "ring-slate-200/80 dark:ring-slate-700/50",     dot: "bg-slate-500"   },
  neutral: { bg: "bg-zinc-50 dark:bg-zinc-800/50",       text: "text-zinc-700 dark:text-zinc-300",       ring: "ring-zinc-200/80 dark:ring-zinc-700/50",       dot: "bg-zinc-500"    },
  indigo:  { bg: "bg-indigo-50 dark:bg-indigo-950/40",   text: "text-indigo-700 dark:text-indigo-300",   ring: "ring-indigo-200/80 dark:ring-indigo-800/50",   dot: "bg-indigo-500"  },
  blue:    { bg: "bg-blue-50 dark:bg-blue-950/40",       text: "text-blue-700 dark:text-blue-300",       ring: "ring-blue-200/80 dark:ring-blue-800/50",       dot: "bg-blue-500"    },
  sky:     { bg: "bg-sky-50 dark:bg-sky-950/40",         text: "text-sky-700 dark:text-sky-300",         ring: "ring-sky-200/80 dark:ring-sky-800/50",         dot: "bg-sky-500"     },
  cyan:    { bg: "bg-cyan-50 dark:bg-cyan-950/40",       text: "text-cyan-700 dark:text-cyan-300",       ring: "ring-cyan-200/80 dark:ring-cyan-800/50",       dot: "bg-cyan-500"    },
  teal:    { bg: "bg-teal-50 dark:bg-teal-950/40",       text: "text-teal-700 dark:text-teal-300",       ring: "ring-teal-200/80 dark:ring-teal-800/50",       dot: "bg-teal-500"    },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200/80 dark:ring-emerald-800/50", dot: "bg-emerald-500" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-200/80 dark:ring-amber-800/50",     dot: "bg-amber-500"   },
  orange:  { bg: "bg-orange-50 dark:bg-orange-950/40",   text: "text-orange-700 dark:text-orange-300",   ring: "ring-orange-200/80 dark:ring-orange-800/50",   dot: "bg-orange-500"  },
  rose:    { bg: "bg-rose-50 dark:bg-rose-950/40",       text: "text-rose-700 dark:text-rose-300",       ring: "ring-rose-200/80 dark:ring-rose-800/50",       dot: "bg-rose-500"    },
  red:     { bg: "bg-red-50 dark:bg-red-950/40",         text: "text-red-700 dark:text-red-300",         ring: "ring-red-200/80 dark:ring-red-800/50",         dot: "bg-red-500"     },
  violet:  { bg: "bg-violet-50 dark:bg-violet-950/40",   text: "text-violet-700 dark:text-violet-300",   ring: "ring-violet-200/80 dark:ring-violet-800/50",   dot: "bg-violet-500"  },
  purple:  { bg: "bg-purple-50 dark:bg-purple-950/40",   text: "text-purple-700 dark:text-purple-300",   ring: "ring-purple-200/80 dark:ring-purple-800/50",   dot: "bg-purple-500"  },
  pink:    { bg: "bg-pink-50 dark:bg-pink-950/40",       text: "text-pink-700 dark:text-pink-300",       ring: "ring-pink-200/80 dark:ring-pink-800/50",       dot: "bg-pink-500"    },
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "h-5 px-1.5 text-meta gap-1",
  sm: "h-6 px-2 text-meta gap-1.5",
};

export function StatusPill({
  label,
  hue = "neutral",
  size = "sm",
  noDot,
  className,
}: StatusPillProps) {
  const c = HUE_CLASSES[hue];
  return (
    <span
      className={cn(
        // `whitespace-nowrap` is deliberate — a pill that wraps stops reading as
        // a pill. But nowrap alone let long labels ("Contract Drafted",
        // "Site Inspection") punch out of a narrow container, which on a 375px
        // phone means spilling across the next field of a stacked card. Cap at
        // the container width and ellipsise instead; the full text stays
        // available to screen readers and as a native tooltip.
        "inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded-full font-medium ring-1 ring-inset whitespace-nowrap",
        c.bg,
        c.text,
        c.ring,
        SIZE_CLASSES[size],
        className
      )}
    >
      {!noDot && (
        <span
          aria-hidden
          className={cn("inline-block size-1.5 shrink-0 rounded-full", c.dot)}
        />
      )}
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
    </span>
  );
}

// ============================================================
// Semantic mappers — wrap StatusPill with project-aware logic
// ============================================================

const LEAD_STATUS_HUE: Record<string, Hue> = {
  NEW: "slate",
  NOT_CONNECTED: "orange",
  CONTACTED: "blue",
  QUALIFIED: "cyan",
  PROPOSAL_SENT: "indigo",
  NEGOTIATION: "amber",
  WON: "emerald",
  LOST: "red",
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  NOT_CONNECTED: "Not Connected",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export function LeadStatusPill({ status, size }: { status: string; size?: Size }) {
  return (
    <StatusPill
      label={LEAD_STATUS_LABEL[status] ?? status}
      hue={LEAD_STATUS_HUE[status] ?? "neutral"}
      size={size}
    />
  );
}

const LEAD_SOURCE_HUE: Record<string, Hue> = {
  WEBSITE: "blue",
  REFERRAL: "emerald",
  SOCIAL_MEDIA: "pink",
  WALK_IN: "amber",
  PHONE_INQUIRY: "cyan",
  EMAIL: "indigo",
  EVENT: "violet",
  PARTNER: "teal",
  ADVERTISEMENT: "orange",
  FACEBOOK_ADS: "blue",
  GOOGLE_ADS: "red",
  INDIAMART: "emerald",
  JUSTDIAL: "amber",
  WEDMEGOOD: "rose",
  INSTAGRAM: "purple",
  WHATSAPP: "emerald",
  OTHER: "neutral",
};

const LEAD_SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  SOCIAL_MEDIA: "Social",
  WALK_IN: "Walk-in",
  PHONE_INQUIRY: "Phone",
  EMAIL: "Email",
  EVENT: "Event",
  PARTNER: "Partner",
  ADVERTISEMENT: "Ads",
  FACEBOOK_ADS: "Facebook",
  GOOGLE_ADS: "Google Ads",
  INDIAMART: "IndiaMart",
  JUSTDIAL: "JustDial",
  WEDMEGOOD: "WedMeGood",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  OTHER: "Other",
};

export function LeadSourcePill({ source, size }: { source: string; size?: Size }) {
  return (
    <StatusPill
      label={LEAD_SOURCE_LABEL[source] ?? source}
      hue={LEAD_SOURCE_HUE[source] ?? "neutral"}
      size={size}
    />
  );
}

// ============================================================
// Hall Owner funnel stage pill (B2B owner-side CRM)
// ============================================================

const HALL_OWNER_HUE: Record<string, Hue> = {
  PROSPECT: "slate",
  CONTACT_MADE: "blue",
  SITE_INSPECTION: "violet",
  NEGOTIATION: "amber",
  CONTRACT_DRAFTED: "orange",
  SIGNED: "teal",
  ONBOARDED: "emerald",
  RENEWAL: "cyan",
  CHURNED: "rose",
};

const HALL_OWNER_LABEL: Record<string, string> = {
  PROSPECT: "Prospect",
  CONTACT_MADE: "Contact Made",
  SITE_INSPECTION: "Site Inspection",
  NEGOTIATION: "Negotiation",
  CONTRACT_DRAFTED: "Contract Drafted",
  SIGNED: "Signed",
  ONBOARDED: "Onboarded",
  RENEWAL: "Renewal",
  CHURNED: "Churned",
};

export function HallOwnerStatusPill({
  status,
  size,
}: {
  status: string;
  size?: Size;
}) {
  return (
    <StatusPill
      label={HALL_OWNER_LABEL[status] ?? status}
      hue={HALL_OWNER_HUE[status] ?? "neutral"}
      size={size}
    />
  );
}
