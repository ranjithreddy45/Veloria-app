import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getPublicInvoiceForPayment } from "@/actions/payment.actions";
import { COMPANY_LEGAL_LINE } from "@/lib/constants";
import { PublicPay } from "./_components/public-pay";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-4 py-10">
      {/* Brand */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Veloria Grand</h1>
        <p className="text-xs text-muted-foreground">{COMPANY_LEGAL_LINE}</p>
      </div>

      {!res.success ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <p className="text-base font-medium">This payment link isn’t valid</p>
          <p className="mt-1 text-sm text-muted-foreground">
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
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <p className="text-sm text-muted-foreground">
                {i.customerName ? `Hi ${i.customerName.split(" ")[0]},` : "Hello,"} here’s your invoice
                {i.eventName ? ` for ${i.eventName}` : ""}.
              </p>

              <div className="mt-4 space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-medium">{i.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="tabular-nums">{inr(i.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid so far</span><span className="tabular-nums text-emerald-600">{inr(i.paid)}</span></div>
                <div className="flex justify-between border-t border-border/60 pt-2 text-base font-bold"><span>Balance due</span><span className="tabular-nums">{inr(i.balanceDue)}</span></div>
              </div>

              {fullyPaid ? (
                <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                  <CheckCircle2 className="size-8 text-emerald-600" />
                  <p className="font-semibold text-emerald-800">This invoice is fully paid</p>
                  <p className="text-sm text-emerald-700">Thank you! Nothing more is due.</p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {amt && payAmount < i.balanceDue && (
                    <p className="rounded-lg bg-primary/5 px-3 py-2 text-[13px] text-foreground">
                      Amount to pay now: <span className="font-semibold">{inr(payAmount)}</span>
                      <span className="text-muted-foreground"> (part payment — balance {inr(i.balanceDue - payAmount)} remains)</span>
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
                </div>
              )}
            </div>
          );
        })()
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Veloria Grand · A Unit of Billion Events Hospitality Services Pvt Ltd
      </p>
    </main>
  );
}
