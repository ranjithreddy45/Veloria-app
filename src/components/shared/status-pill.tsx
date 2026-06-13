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

// Tailwind needs full classnames at build time, so we map explicitly.
const HUE_CLASSES: Record<Hue, { bg: string; text: string; ring: string; dot: string }> = {
  slate:   { bg: "bg-slate-50",   text: "text-slate-700",   ring: "ring-slate-200/80",   dot: "bg-slate-500"   },
  neutral: { bg: "bg-zinc-50",    text: "text-zinc-700",    ring: "ring-zinc-200/80",    dot: "bg-zinc-500"    },
  indigo:  { bg: "bg-indigo-50",  text: "text-indigo-700",  ring: "ring-indigo-200/80",  dot: "bg-indigo-500"  },
  blue:    { bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-200/80",    dot: "bg-blue-500"    },
  sky:     { bg: "bg-sky-50",     text: "text-sky-700",     ring: "ring-sky-200/80",     dot: "bg-sky-500"     },
  cyan:    { bg: "bg-cyan-50",    text: "text-cyan-700",    ring: "ring-cyan-200/80",    dot: "bg-cyan-500"    },
  teal:    { bg: "bg-teal-50",    text: "text-teal-700",    ring: "ring-teal-200/80",    dot: "bg-teal-500"    },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200/80", dot: "bg-emerald-500" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200/80",   dot: "bg-amber-500"   },
  orange:  { bg: "bg-orange-50",  text: "text-orange-700",  ring: "ring-orange-200/80",  dot: "bg-orange-500"  },
  rose:    { bg: "bg-rose-50",    text: "text-rose-700",    ring: "ring-rose-200/80",    dot: "bg-rose-500"    },
  red:     { bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200/80",     dot: "bg-red-500"     },
  violet:  { bg: "bg-violet-50",  text: "text-violet-700",  ring: "ring-violet-200/80",  dot: "bg-violet-500"  },
  purple:  { bg: "bg-purple-50",  text: "text-purple-700",  ring: "ring-purple-200/80",  dot: "bg-purple-500"  },
  pink:    { bg: "bg-pink-50",    text: "text-pink-700",    ring: "ring-pink-200/80",    dot: "bg-pink-500"    },
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "h-5 px-1.5 text-[10.5px] gap-1",
  sm: "h-6 px-2 text-[11.5px] gap-1.5",
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
        "inline-flex items-center rounded-full font-medium ring-1 ring-inset whitespace-nowrap",
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
      {label}
    </span>
  );
}

// ============================================================
// Semantic mappers — wrap StatusPill with project-aware logic
// ============================================================

const LEAD_STATUS_HUE: Record<string, Hue> = {
  NEW: "slate",
  CONTACTED: "blue",
  QUALIFIED: "cyan",
  PROPOSAL_SENT: "indigo",
  NEGOTIATION: "amber",
  WON: "emerald",
  LOST: "red",
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "New",
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
