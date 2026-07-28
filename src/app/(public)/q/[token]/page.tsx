import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { COMPANY_LEGAL_LINE } from "@/lib/constants";
// Backend (quote-onetap / quote-radar agents) PUBLIC actions — no auth, the
// unguessable token is the access control. Imported as if exported; central
// wiring confirms the exports (see sharedEditsNeeded / assumptions).
import { getPublicQuoteForPay, getPublicSlotScarcity } from "@/actions/quote-onetap.actions";
import { getSocialProof } from "@/lib/public/social-proof";
import { HelpChip } from "@/components/public/help-chip";
import { PublicQuoteView } from "./_components/public-quote-view";
import { QuoteRadarBeacon } from "./_components/quote-radar-beacon";

// ============================================================
// PUBLIC tokenized quote page — /q/[token] (no auth, noindex).
// ------------------------------------------------------------
// Renders the frozen SalesQuotation.outputsJson snapshot(s) for a QuoteShareLink
// resolved by its unguessable token: Good-Better-Best tiers side-by-side, the
// one-tap "Pay 20% to block your date" CTA, live slot scarcity, and the
// social-proof strip. A bad/revoked/expired token shows a friendly card that
// leaks NO internal data. Mirrors the /pay/[token] + /hold/[token] public shell.
//
// SECURITY: every field rendered comes ONLY from getPublicQuoteForPay's
// payer-safe projection (build-public-view) — never leadId, rep identity,
// cost/margin, internal notes, or other quotations.
// ============================================================

export const metadata: Metadata = {
  title: "Your quote — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized page; keep out of search
};

function InvalidCard() {
  return (
    <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="size-6" />
      </div>
      <p className="font-editorial text-foreground mt-5 text-[24px] font-semibold">
        This quote link isn&apos;t valid
      </p>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        It may have expired or been replaced by a newer version. Reach out and
        we&apos;ll send you a fresh one.
      </p>
      <HelpChip variant="banner" className="mt-6" />
    </div>
  );
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await getPublicQuoteForPay(token);

  if (!res.success) {
    return (
      <>
        <BrandHero />
        <InvalidCard />
        <TrustFooter />
      </>
    );
  }

  const view = res.data;

  // Live per-slot scarcity + matched social proof — both best-effort; a failure
  // must never block the quote render.
  const [scarcityRes, socialProof] = await Promise.all([
    view.paid || view.blocked ? Promise.resolve(null) : getPublicSlotScarcity(token).catch(() => null),
    view.showSocialProof
      ? getSocialProof({ eventType: view.eventType ?? undefined, venueId: view.venueId ?? undefined })
      : Promise.resolve(null),
  ]);
  const scarcity = scarcityRes && scarcityRes.success ? scarcityRes.data : null;

  // Which tier the viewer lands on first (for the radar beacon focus signal).
  const focusedQuotationId =
    view.tiers.find((t) => t.isRecommended)?.quotationId ?? view.tiers[0]?.quotationId;

  return (
    <>
      <BrandHero />
      <PublicQuoteView view={view} scarcity={scarcity} socialProof={socialProof} />
      <TrustFooter />
      {/* Fire-and-forget view tracking (device/ipHash derived server-side). */}
      <QuoteRadarBeacon token={token} viewedQuotationId={focusedQuotationId} />
    </>
  );
}

function BrandHero() {
  return (
    <header className="mb-9 text-center">
      <div className="logo-chip mx-auto flex size-14 items-center justify-center rounded-2xl">
        <span className="font-editorial text-2xl font-semibold leading-none text-white drop-shadow-sm">
          V
        </span>
      </div>
      {/* Visually a wordmark, not the page heading — the quote headline owns h1. */}
      <p className="large-title text-foreground mt-4 text-[28px]">
        Veloria Grand
      </p>
      <p className="text-muted-foreground/80 mt-2 text-[11px] uppercase tracking-[0.14em]">
        {COMPANY_LEGAL_LINE}
      </p>
    </header>
  );
}

function TrustFooter() {
  return (
    <footer className="mt-12 space-y-1.5 border-t pt-6 text-center">
      <p className="text-muted-foreground text-[11px]">
        256-bit secure payment · powered by Razorpay
      </p>
      <p className="text-muted-foreground/70 text-[11px]">
        Veloria Grand · A Unit of Billion Events Hospitality Services Pvt Ltd
      </p>
    </footer>
  );
}
