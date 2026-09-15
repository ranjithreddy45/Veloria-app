import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck, Users, AlertTriangle, Clock, Ban } from "lucide-react";
import { getPublicSplitForPayment } from "@/actions/payment-split.actions";
import { formatPaise } from "@/lib/payments/split-format";
import { COMPANY_LEGAL_LINE } from "@/lib/constants";
import { HelpChip } from "@/components/public/help-chip";
import { SplitPay } from "./_components/split-pay";

export const metadata: Metadata = {
  title: "Pay your share — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized page; keep out of search
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** A terminal-state card (paid / expired / cancelled / not payable). */
function StateCard({
  tone,
  icon,
  title,
  body,
  reference,
}: {
  tone: "success" | "warn" | "muted";
  icon: ReactNode;
  title: string;
  body: string;
  reference: string;
}) {
  const wrap =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
        : "border-border bg-muted/40";
  const heading =
    tone === "success"
      ? "text-emerald-800 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-800 dark:text-amber-300"
        : "text-foreground";
  const copy =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <div className="mt-6 space-y-3">
      <div className={`flex flex-col items-center gap-2 rounded-2xl border p-6 text-center ${wrap}`}>
        {icon}
        <p className={`font-semibold ${heading}`}>{title}</p>
        <p className={`text-sm ${copy}`}>{body}</p>
      </div>
      <HelpChip variant="banner" message={reference} />
    </div>
  );
}

export default async function PaySplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await getPublicSplitForPayment(token);

  return (
    <main className="relative min-h-screen bg-aura bg-grid-faint">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-4 pb-[calc(2rem+var(--sab))] pt-[calc(2rem+var(--sat))] sm:gap-6 sm:pb-[calc(3rem+var(--sab))] sm:pt-[calc(3rem+var(--sat))]">
        {/* ---- Brand hero (same rhythm as /pay) ---- */}
        <header className="text-center">
          <div className="logo-chip mx-auto flex size-12 items-center justify-center rounded-2xl sm:size-14">
            <span className="font-serif text-2xl font-semibold leading-none text-white drop-shadow-sm">V</span>
          </div>
          <h1 className="large-title mt-3 text-2xl text-ink-gradient sm:mt-4 sm:text-3xl">Veloria Grand</h1>
          <p className="mt-1.5 text-meta text-muted-foreground sm:text-xs">{COMPANY_LEGAL_LINE}</p>
        </header>

        {!res.success ? (
          <div className="rounded-2xl border border-border bg-card p-7 text-center shadow-premium">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="size-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">This payment link isn&apos;t valid</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We couldn&apos;t find this share. Please ask the person who sent it for a fresh link.
            </p>
            <HelpChip variant="banner" className="mt-5" />
          </div>
        ) : (
          (() => {
            const s = res.data;
            const reference = `Split payment · ${s.invoiceNumber} · ${s.payerName}`;
            const firstName = s.payerName.split(" ")[0];
            const hostFirst = s.hostName.split(" ")[0] || "the host";
            const canPay = s.status === "PENDING" && s.invoicePayable && !s.exceedsOutstanding;

            return (
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-premium">
                {/* Card header */}
                <div className="flex items-start gap-3 border-b border-border/60 p-5 sm:p-6">
                  <div className="ring-glow-brand flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Hi {firstName}, {hostFirst} has asked you to chip in
                      {s.eventName ? ` for ${s.eventName}` : ""}.
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Invoice <span className="font-semibold text-foreground">{s.invoiceNumber}</span>
                      {s.eventDate ? ` · ${longDate(s.eventDate)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {/* Share summary */}
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm sm:p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Paying as</span>
                      <span className="font-medium text-foreground">{s.payerName}</span>
                    </div>
                    <div className="divider-fade my-4" />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-copy font-semibold text-foreground">Your share</span>
                      <span className="large-title tabular-nums text-h2 leading-none text-ink-gradient sm:text-2xl">
                        {formatPaise(s.amountPaise)}
                      </span>
                    </div>
                    {s.status === "PENDING" && s.expiresAt && canPay && (
                      <p className="mt-3 flex items-center gap-1.5 text-meta text-muted-foreground">
                        <Clock className="size-3" /> Link valid until {longDate(s.expiresAt)}
                      </p>
                    )}
                  </div>

                  {s.status === "PAID" ? (
                    <StateCard
                      tone="success"
                      icon={<CheckCircle2 className="size-9 text-emerald-600 dark:text-emerald-400" />}
                      title="Your share is paid"
                      body={`${formatPaise(s.amountPaise)} received${s.paidAt ? ` on ${longDate(s.paidAt)}` : ""}. Thank you — ${hostFirst} has been told.`}
                      reference={reference}
                    />
                  ) : s.status === "EXPIRED" ? (
                    <StateCard
                      tone="warn"
                      icon={<Clock className="size-9 text-amber-600 dark:text-amber-400" />}
                      title="This link has expired"
                      body={`Please ask ${hostFirst} to send you a fresh payment link.`}
                      reference={reference}
                    />
                  ) : s.status === "CANCELLED" ? (
                    <StateCard
                      tone="muted"
                      icon={<Ban className="size-9 text-muted-foreground" />}
                      title="This link was cancelled"
                      body={`${hostFirst} withdrew this share. Nothing is due from you on this link.`}
                      reference={reference}
                    />
                  ) : !s.invoicePayable ? (
                    <StateCard
                      tone="success"
                      icon={<CheckCircle2 className="size-9 text-emerald-600 dark:text-emerald-400" />}
                      title="Nothing left to pay"
                      body="This invoice has already been settled. Thank you!"
                      reference={reference}
                    />
                  ) : s.exceedsOutstanding ? (
                    <StateCard
                      tone="warn"
                      icon={<AlertTriangle className="size-9 text-amber-600 dark:text-amber-400" />}
                      title="This share needs updating"
                      body={`Only ${formatPaise(s.outstandingPaise)} is still due on this invoice, which is less than your share. Please ask ${hostFirst} for a fresh link.`}
                      reference={reference}
                    />
                  ) : (
                    <div className="mt-6 space-y-3">
                      <SplitPay
                        token={token}
                        invoiceId={s.invoiceId}
                        invoiceNumber={s.invoiceNumber}
                        amountRupees={s.amountPaise / 100}
                        payerName={s.payerName}
                        payerEmail={s.payerEmail}
                        payerPhone={s.payerPhone}
                        eventName={s.eventName}
                      />
                    </div>
                  )}
                </div>
              </div>
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
