import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, FileText, AlertTriangle } from "lucide-react";
import { getPublicInvoiceForPayment } from "@/actions/payment.actions";
import { getSocialProof } from "@/lib/public/social-proof";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import { COMPANY_LEGAL_LINE } from "@/lib/constants";
import { HelpChip } from "@/components/public/help-chip";
import { PublicPay } from "./_components/public-pay";
import { PayAmountPicker } from "./_components/pay-amount-picker";

export const metadata: Metadata = {
  title: "Pay invoice — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized invoice page; keep out of search
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ amt?: string }>;
}) {
  const { token } = await params;
  const { amt } = await searchParams;
  const res = await getPublicInvoiceForPayment(token);

  // Social proof — best-effort (getSocialProof never throws; returns empty on
  // failure). A proof-query failure must never block the Razorpay button.
  const socialProof = res.success
    ? await getSocialProof({
        eventType: res.data.eventType ?? undefined,
        venueId: res.data.venueId ?? undefined,
      }).catch(() => null)
    : null;

  return (
    <main className="relative min-h-screen bg-aura bg-grid-faint">
      {/* Safe-area insets folded into the padding — this page is opened from a
          WhatsApp link and, once installed, runs full-screen with no chrome.
          The mobile rhythm is deliberately tighter than desktop: every pixel
          spent on the brand hero is a pixel that pushes the Pay button below
          the fold on a 375x812 screen. */}
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-4 pb-[calc(2rem+var(--sab))] pt-[calc(2rem+var(--sat))] sm:gap-6 sm:pb-[calc(3rem+var(--sab))] sm:pt-[calc(3rem+var(--sat))]">
        {/* ---- Brand hero ---- */}
        <header className="text-center">
          <div className="logo-chip mx-auto flex size-12 items-center justify-center rounded-2xl sm:size-14">
            <span className="font-serif text-2xl font-semibold leading-none text-white drop-shadow-sm">
              V
            </span>
          </div>
          <h1 className="large-title mt-3 text-2xl text-ink-gradient sm:mt-4 sm:text-3xl">
            Veloria Grand
          </h1>
          <p className="mt-1.5 text-meta text-muted-foreground sm:text-xs">
            {COMPANY_LEGAL_LINE}
          </p>
        </header>

        {!res.success ? (
          <div className="rounded-2xl border border-border bg-card p-7 text-center shadow-premium">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="size-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">
              This payment link isn&apos;t valid
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The invoice could not be found. Please contact us for an updated link.
            </p>
            <HelpChip variant="banner" className="mt-5" />
          </div>
        ) : (
          (() => {
            const i = res.data;
            const fullyPaid = i.status === "PAID" || i.balanceDue <= 0;
            // Amount to collect: the link's suggested amount, clamped to the balance.
            const suggested = amt ? Math.round(Number(amt)) : i.balanceDue;
            const payAmount = Math.max(1, Math.min(i.balanceDue, Number.isFinite(suggested) ? suggested : i.balanceDue));

            return (
              <>
              {!fullyPaid && socialProof && (
                <SocialProofStrip variant="banner" data={socialProof} className="mb-4" />
              )}
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-premium">
                {/* Card header */}
                <div className="flex items-start gap-3 border-b border-border/60 p-5 sm:p-6">
                  <div className="ring-glow-brand flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {i.customerName ? `Hi ${i.customerName.split(" ")[0]},` : "Hello,"} here&apos;s your
                      invoice{i.eventName ? ` for ${i.eventName}` : ""}.
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Invoice <span className="font-semibold text-foreground">{i.invoiceNumber}</span>
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {/* Invoice summary */}
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm sm:p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="tabular-nums font-medium text-foreground">{inr(i.total)}</span>
                    </div>
                    <div className="mt-2.5 flex items-baseline justify-between">
                      <span className="text-muted-foreground">Paid so far</span>
                      <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        {inr(i.paid)}
                      </span>
                    </div>
                    <div className="divider-fade my-4" />
                    {/* The balance is the one number the customer is here for —
                        it wraps to its own line rather than shrinking when the
                        figure is long (₹1,25,00,000 at 375px). */}
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-copy font-semibold text-foreground">Balance due</span>
                      <span className="large-title tabular-nums text-h2 leading-none text-ink-gradient sm:text-2xl">
                        {inr(i.balanceDue)}
                      </span>
                    </div>
                  </div>

                  {fullyPaid ? (
                    <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                      <CheckCircle2 className="size-9 text-emerald-600 dark:text-emerald-400" />
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                        This invoice is fully paid
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        Thank you! Nothing more is due.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-3">
                      {amt ? (
                        <>
                          {/* Link pinned an explicit amount — keep it authoritative. */}
                          {payAmount < i.balanceDue && (
                            <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-body text-foreground">
                              Amount to pay now: <span className="font-semibold">{inr(payAmount)}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                (part payment — balance {inr(i.balanceDue - payAmount)} remains)
                              </span>
                            </p>
                          )}
                          <PublicPay
                            invoiceId={i.id}
                            invoiceNumber={i.invoiceNumber}
                            amount={payAmount}
                            customerName={i.customerName}
                            customerEmail={i.customerEmail}
                            customerPhone={i.customerPhone}
                          />
                        </>
                      ) : (
                        /* No pinned amount — default to the due installment
                           (staged plan), full balance one tap away. */
                        <PayAmountPicker
                          invoiceId={i.id}
                          invoiceNumber={i.invoiceNumber}
                          nextDue={i.nextDue}
                          balanceDue={i.balanceDue}
                          customerName={i.customerName}
                          customerEmail={i.customerEmail}
                          customerPhone={i.customerPhone}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
              </>
            );
          })()
        )}

        {/* ---- Trust footer ---- */}
        <footer className="space-y-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-detail font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            256-bit secure payment · powered by Razorpay
          </p>
          <p className="text-meta text-muted-foreground">
            Veloria Grand · A Unit of Billion Events Hospitality Services Pvt Ltd
          </p>
        </footer>
      </div>
    </main>
  );
}
