import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, FileText, AlertTriangle } from "lucide-react";
import { getPublicInvoiceForPayment } from "@/actions/payment.actions";
import { getSocialProof } from "@/lib/public/social-proof";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import { COMPANY_LEGAL_LINE } from "@/lib/constants";
import { PublicPay } from "./_components/public-pay";
import { PayAmountPicker } from "./_components/pay-amount-picker";

export const metadata: Metadata = { title: "Pay invoice — Veloria Grand" };

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
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-12">
        {/* ---- Brand hero ---- */}
        <header className="text-center">
          <div className="logo-chip mx-auto flex size-14 items-center justify-center rounded-2xl">
            <span className="font-serif text-2xl font-semibold leading-none text-white drop-shadow-sm">
              V
            </span>
          </div>
          <h1 className="large-title mt-4 text-3xl text-ink-gradient">Veloria Grand</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">{COMPANY_LEGAL_LINE}</p>
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
                <div className="flex items-start gap-3 border-b border-border/60 p-6">
                  <div className="ring-glow-violet flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
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

                <div className="p-6">
                  {/* Invoice summary */}
                  <div className="rounded-2xl bg-muted/40 p-5 text-sm">
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
                    <div className="flex items-baseline justify-between">
                      <span className="text-[15px] font-semibold text-foreground">Balance due</span>
                      <span className="large-title tabular-nums text-2xl text-ink-gradient">
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
                            <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-[13px] text-foreground">
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
                           (20/60/20 plan), full balance one tap away. */
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
          <p className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            256-bit secure payment · powered by Razorpay
          </p>
          <p className="text-[11px] text-muted-foreground">
            Veloria Grand · A Unit of Billion Events Hospitality Services Pvt Ltd
          </p>
        </footer>
      </div>
    </main>
  );
}
