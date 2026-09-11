import Link from "next/link";
import { requireGuest } from "@/lib/guest-session";
import { getGuestPayments } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, Card, ProgressBar, SectionTitle, EmptyNote, KeyValue } from "../../_components/ui";
import { inr, fmtDate } from "../../_components/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requireGuest("/app/payments");
  const p = await getGuestPayments();
  const paidPct = p && p.total > 0 ? Math.round((p.paid / p.total) * 100) : 0;

  return (
    <Screen className="gap-[18px]">
      <ScreenHeader title="Payments" backHref="/app/event" />
      {!p || p.invoices.length === 0 ? <EmptyNote>No invoices yet. Your schedule appears here once the team issues the first one.</EmptyNote> : (
        <>
          <Card className="rounded-[22px] p-5">
            <div className="text-meta text-[#6e6e73]">Balance remaining</div>
            <div className="numeric mt-1.5 text-[38px] font-semibold leading-[1.05] tracking-[-.02em]">{inr(p.balance)}</div>
            <div className="mt-1.5 text-detail text-[#6e6e73]">of {inr(p.total)} across {p.invoices.length} invoice{p.invoices.length === 1 ? "" : "s"}</div>
            <ProgressBar pct={paidPct} className="mt-3.5" />
          </Card>

          <div>
            <SectionTitle title="Schedule" />
            <div className="mt-2.5 flex flex-col gap-2">
              {(p.installments.length > 0 ? p.installments.map((i) => ({ key: i.id, label: i.label, due: i.dueDate, amount: i.amount, paid: i.status === "COMPLETED", payable: i.payable, invoiceId: i.invoiceId, status: i.status }))
                : p.invoices.map((i, idx) => ({ key: i.id, label: `Invoice ${i.number}`, due: i.dueDate, amount: i.balance > 0 ? i.balance : i.total, paid: i.balance <= 0, payable: i.balance > 0 && idx === p.invoices.findIndex((x) => x.balance > 0), invoiceId: i.id, status: i.status }))
              ).map((row) => (
                <Card key={row.key} className="flex items-center gap-3 rounded-[14px] px-4 py-3.5">
                  <div className="min-w-0 flex-1"><div className="truncate text-body font-semibold">{row.label}</div><div className="text-meta text-[#6e6e73]">{row.paid ? "Paid" : `Due ${fmtDate(row.due, { day: "numeric", month: "short", year: "numeric" })}`}</div></div>
                  <div className="text-right"><div className="numeric text-body font-semibold">{inr(row.amount)}</div><div className={`text-meta font-semibold ${row.paid ? "text-[#2a9d4a]" : row.payable ? "text-[#c77700]" : "text-[#6e6e73]"}`}>{row.paid ? "Paid" : row.payable ? "Due" : "Upcoming"}</div></div>
                  {row.payable && <Link href={`/pay/${row.invoiceId}`} className="rounded-[10px] bg-[#6d1b52] px-3.5 py-2.5 text-detail font-semibold text-[#fdf5f3]">Pay</Link>}
                </Card>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle title="Invoices" />
            <div className="mt-2.5">
              <KeyValue rows={p.invoices.map((i) => ({ k: `${i.number}${i.eventName ? ` · ${i.eventName}` : ""}`, v: <Link href={`/portal/invoices/${i.id}`} className="text-[#6d1b52]">{inr(i.total)}</Link> }))} total={{ k: "Paid to date", v: inr(p.paid) }} />
            </div>
          </div>
          <p className="text-center text-meta leading-[1.55] text-[#8a8a8e]">GST invoice issued on each payment · receipts in Documents.</p>
        </>
      )}
    </Screen>
  );
}
