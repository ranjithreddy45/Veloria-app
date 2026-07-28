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
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <h1 className="text-foreground text-[24px]">
          This referral link isn’t active
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          It may have expired or been deactivated. Ask your friend for a fresh
          link — or reach out to us directly and we’ll be glad to help plan your
          celebration.
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
      <div className="bg-card shadow-card relative overflow-hidden rounded-2xl border px-8 py-12 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl">
          <Gift className="size-6" />
        </div>
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]">
          <Sparkles className="size-3" />
          Referred by {partner.referrerDisplayName}
        </p>
        <h1 className="text-foreground mt-4 text-[30px] sm:text-[36px]">
          Plan your event at {partner.venueName}
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-md text-[15px] leading-relaxed">
          {partner.referrerDisplayName} thought you’d love Veloria Grand for your
          celebration. Tell us a little about your day and our team will come
          back with bespoke options — no obligation.
        </p>
      </div>

      {/* Intake form */}
      <div className="bg-card shadow-card rounded-2xl border p-6 sm:p-8">
        <ReferralIntakeForm code={code} utm={utm} />
      </div>
    </div>
  );
}

function pick(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
