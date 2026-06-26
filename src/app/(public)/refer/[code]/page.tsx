import type { Metadata } from "next";
import { Gift, Sparkles } from "lucide-react";
import { getReferralPartnerByCode } from "@/actions/public-referral.actions";
import { ReferralIntakeForm } from "./_components/referral-intake-form";

// ============================================================
// PUBLIC referral landing page — /refer/<code> (no auth)
// ------------------------------------------------------------
// Mounted under the (public) route group on the /refer prefix (NOT /referrals)
// so middleware INTERNAL_ROUTES (startsWith "/referrals") never gates it.
// Resolves a ReferralPartner by its unguessable code via a no-leak public
// action. Invalid/inactive code → friendly card with zero internal data leak.
// ============================================================

export const metadata: Metadata = {
  title: "You've been referred — Veloria Grand",
};

export default async function ReferralPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const partner = await getReferralPartnerByCode(code);

  // Invalid / inactive code — friendly card, no internal leak.
  if (!partner.found) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <p className="text-base font-medium">This referral link isn’t active</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The link may have expired or been deactivated. If a friend shared it
          with you, ask them for an updated link — or reach out to Veloria Grand
          directly and we’ll be glad to help plan your event.
        </p>
      </div>
    );
  }

  const utm = {
    utmSource: pick(sp.utm_source),
    utmMedium: pick(sp.utm_medium),
    utmCampaign: pick(sp.utm_campaign),
  };

  return (
    <div className="space-y-6">
      {/* Brand hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 via-card to-pink-500/5 p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
          <Gift className="size-6" />
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          <Sparkles className="size-3" />
          Referred by {partner.referrerDisplayName}
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Plan your event at {partner.venueName}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {partner.referrerDisplayName} thought you’d love Veloria Grand for your
          celebration. Tell us a little about your event and our team will reach
          out with bespoke options — no obligation.
        </p>
      </div>

      {/* Intake form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <ReferralIntakeForm code={code} utm={utm} />
      </div>
    </div>
  );
}

function pick(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
