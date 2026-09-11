import Link from "next/link";
import { requireGuest } from "@/lib/guest-session";
import { getGuestDocuments } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, Card, Pill, EmptyNote } from "../../../_components/ui";
import { inr, fmtDate } from "../../../_components/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  await requireGuest("/app/event/documents");
  const d = await getGuestDocuments();

  return (
    <Screen className="gap-4">
      <ScreenHeader title="Documents" backHref="/app/event" />
      {!d ? <EmptyNote>No booking linked yet.</EmptyNote> : (
        <>
          {d.toSign.map((s) => (
            <div key={s.token} className="flex flex-col gap-3 rounded-[18px] border border-[#b88513]/35 bg-gradient-to-br from-[#fff8e6] to-[#fdf1cf] p-4">
              <div><div className="text-[10.5px] font-bold uppercase tracking-[.1em] text-[#b88513]">Action needed</div><div className="mt-1 text-copy font-semibold">{s.title}</div><div className="mt-0.5 text-detail text-[#6e6e73]">Review and sign with your phone.{s.sentAt ? ` Sent ${fmtDate(s.sentAt)}.` : ""}</div></div>
              <Link href={`/sign/${s.token}`} className="rounded-[14px] bg-[#1d1d1f] py-3.5 text-center text-body font-semibold text-white">Review &amp; e-sign</Link>
            </div>
          ))}
          {d.contracts.length === 0 && d.invoices.length === 0 && d.toSign.length === 0 && <EmptyNote>Your agreement, invoices and event order will collect here as the team issues them.</EmptyNote>}
          {d.contracts.length > 0 && (
            <Card className="vg-divide overflow-hidden">
              {d.contracts.map((c) => (
                <Link key={c.id} href={`/portal/contracts/${c.id}`} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="flex h-[46px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-black/[.06] bg-[#f7eef2] text-[9px] font-bold tracking-[.05em] text-[#6d1b52]">PDF</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold">{c.title}</span><span className="block text-meta text-[#6e6e73]">{c.signedAt ? `Signed ${fmtDate(c.signedAt, { day: "numeric", month: "short", year: "numeric" })}` : c.status.replaceAll("_", " ").toLowerCase()}</span></span>
                  <Pill tone={c.status === "SIGNED" ? "green" : c.status === "SENT" || c.status === "VIEWED" ? "amber" : "grey"}>{c.status === "SIGNED" ? "Signed" : c.status === "SENT" || c.status === "VIEWED" ? "To sign" : c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Pill>
                </Link>
              ))}
            </Card>
          )}
          {d.invoices.length > 0 && (
            <Card className="vg-divide overflow-hidden">
              {d.invoices.map((i) => (
                <Link key={i.id} href={`/portal/invoices/${i.id}`} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="flex h-[46px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-black/[.06] bg-[#e9e9ec] text-[9px] font-bold tracking-[.05em] text-[#1d1d1f]">INV</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold">Invoice {i.number}</span><span className="block text-meta text-[#6e6e73]">{fmtDate(i.issued, { day: "numeric", month: "short", year: "numeric" })} · {inr(i.total)}</span></span>
                  <Pill tone={i.balance <= 0 ? "green" : i.status === "OVERDUE" ? "amber" : "plum"}>{i.balance <= 0 ? "Paid" : i.status === "OVERDUE" ? "Overdue" : "Open"}</Pill>
                </Link>
              ))}
            </Card>
          )}
          <p className="text-center text-meta text-[#8a8a8e]">GST invoices are issued on each payment.</p>
        </>
      )}
    </Screen>
  );
}
