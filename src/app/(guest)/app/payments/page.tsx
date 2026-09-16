import Link from "next/link";
import { Download } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestPaymentsScreen, type GuestPaymentsScreen } from "@/actions/guest-payments.actions";
import { getPublicContact } from "@/lib/public/business-contact";
import { formatIstDate } from "@/app/api/guest/receipt/guest-money";
import { ContactLinks } from "../../_components/contact-links";
import { Screen, ScreenHeader, Card, ProgressBar, SectionTitle, EmptyNote, KeyValue, Pill, Chip, type Tone } from "../../_components/ui";
import { inr } from "../../_components/format";

export const dynamic = "force-dynamic";

// ============================================================
// Payments — the booking's invoices, instalments and receipts, read from the
// same records the finance team works on (guest-payments.actions.ts). Every
// figure is a stored field; "Balance due" is the overview's figure.
// ============================================================

type Invoice = GuestPaymentsScreen["invoices"][number];
type Receipt = GuestPaymentsScreen["receipts"][number];

const shortDate = (iso: string) => formatIstDate(iso, { day: "numeric", month: "short", year: "numeric" });

function invoiceTone(status: string): Tone {
  if (status === "PAID") return "green";
  if (status === "OVERDUE") return "amber";
  if (status === "REFUNDED" || status === "CANCELLED") return "grey";
  return "plum";
}

function receiptTone(status: string): Tone {
  if (status === "COMPLETED") return "green";
  if (status === "PENDING") return "amber";
  return "grey";
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-[12px] bg-[#f5f3f0] px-2 py-2">
      <div className="text-meta text-[#6e6e73]">{label}</div>
      <div className={`numeric mt-0.5 text-detail font-semibold ${strong ? "text-[#6d1b52]" : ""}`}>{value}</div>
    </div>
  );
}

function InvoiceCard({ inv }: { inv: Invoice }) {
  return (
    <Card className="flex flex-col gap-3 rounded-[18px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-body font-semibold">Invoice {inv.number}</div>
          <div className="text-meta text-[#6e6e73]">Issued {shortDate(inv.issueDate)}</div>
        </div>
        <Pill tone={invoiceTone(inv.status)}>{inv.statusLabel}</Pill>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Figure label="Total" value={inr(inv.total)} />
        <Figure label="Paid" value={inr(inv.paid)} />
        <Figure label="Balance" value={inr(inv.balanceDue)} strong />
      </div>

      {inv.installments.length > 0 && (
        <ul className="vg-divide overflow-hidden rounded-[12px] border border-black/[.06]">
          {inv.installments.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-detail font-semibold">{i.label}</div>
                <div className="text-meta text-[#6e6e73]">
                  {i.status === "COMPLETED" && i.paidAt ? `Paid ${shortDate(i.paidAt)}` : `Due by ${shortDate(i.dueDate)}`}
                </div>
              </div>
              <div className="text-right">
                <div className="numeric text-detail font-semibold">{inr(i.amount)}</div>
                <div className={`text-meta font-semibold ${i.status === "COMPLETED" ? "text-[#2a9d4a]" : "text-[#6e6e73]"}`}>{i.statusLabel}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {inv.payable && (
        <Link
          href={`/pay/${encodeURIComponent(inv.id)}`}
          className="vg-primary vg-press flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-body font-semibold"
        >
          <span className="min-w-0 truncate">{inv.nextDue ? `Pay now · ${inv.nextDue.label}` : "Pay the balance"}</span>
          <span className="numeric shrink-0">{inr(inv.nextDue ? inv.nextDue.amount : inv.balanceDue)}</span>
        </Link>
      )}

      {inv.downloadUrl && (
        <a
          href={inv.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-[12px] border border-black/[.08] bg-white px-3 py-2.5 text-detail font-semibold text-[#1d1d1f]"
        >
          <Download className="size-4" aria-hidden /> Download invoice
        </a>
      )}
    </Card>
  );
}

function ReceiptRow({ r }: { r: Receipt }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-semibold">
          {r.receiptNumber ?? (r.status === "PENDING" ? "Payment proof sent" : "Payment")}
        </div>
        <div className="truncate text-meta text-[#6e6e73]">
          {shortDate(r.date)} · {r.methodLabel} · {r.invoiceNumber}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="numeric text-body font-semibold">{inr(r.amount)}</div>
        <Pill tone={receiptTone(r.status)} className="mt-1">
          {r.statusLabel}
        </Pill>
      </div>
      {r.downloadUrl && (
        <a
          href={r.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download receipt ${r.receiptNumber ?? ""}`.trim()}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-black/[.08] bg-white text-[#1d1d1f]"
        >
          <Download className="size-4" aria-hidden />
        </a>
      )}
    </div>
  );
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  await requireGuest(b ? `/app/payments?b=${encodeURIComponent(b)}` : "/app/payments");
  const [p, contact] = await Promise.all([getGuestPaymentsScreen(b), getPublicContact()]);
  const booking = p?.booking ?? null;
  const paidPct = p && p.summary.invoiced > 0 ? (p.summary.paid / p.summary.invoiced) * 100 : 0;
  const reachable = !!(contact.phone || contact.whatsapp);

  return (
    <Screen className="gap-[18px] pb-4">
      <ScreenHeader
        title="Payments"
        backHref={booking ? `/app/event?b=${encodeURIComponent(booking.id)}` : "/app/event"}
        sub={booking ? `${booking.eventName} · ${shortDate(booking.date)}` : undefined}
      />

      {p?.preview && (
        <div className="rounded-xl border border-[#b88513]/35 bg-[#faf3e1] px-3.5 py-2.5 text-detail text-[#6e4f0e]">
          <span className="font-semibold">Staff preview.</span> You&apos;re seeing this booking&apos;s payments as its host would. Nothing here can be changed.
        </div>
      )}
      {p?.invitedBooking && (
        <p className="rounded-xl border border-black/[.08] bg-white px-3.5 py-2.5 text-detail text-[#6e6e73]">
          Payments for {p.invitedBooking.eventName} are handled by its host, so they don&apos;t appear in your account.
        </p>
      )}
      {p && p.bookings.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {p.bookings.map((x) => (
            <Chip key={x.id} href={`/app/payments?b=${encodeURIComponent(x.id)}`} active={x.id === booking?.id}>
              {x.eventName}
            </Chip>
          ))}
        </div>
      )}

      {!p ? (
        <EmptyNote>We couldn&apos;t load your payments. Please try again.</EmptyNote>
      ) : p.hiddenInPreview ? (
        <EmptyNote>Staff preview: invoices and payments are hidden because your role can&apos;t open the team&apos;s finance screens.</EmptyNote>
      ) : !booking && !p.unlinked ? (
        <EmptyNote>No booking is linked to this account yet. Your invoices and payments appear here once your booking is made.</EmptyNote>
      ) : (
        <>
          {booking &&
            (p.summary.invoiceCount === 0 ? (
              <EmptyNote>No invoices for this event yet. They appear here as soon as the team issues them.</EmptyNote>
            ) : (
              <Card className="rounded-[22px] p-5">
                <div className="text-meta text-[#6e6e73]">Balance due</div>
                <div className="numeric mt-1.5 text-[38px] font-semibold leading-[1.05] tracking-[-.02em]">{inr(p.summary.balanceDue)}</div>
                <div className="mt-1.5 text-detail text-[#6e6e73]">
                  Paid {inr(p.summary.paid)} of {inr(p.summary.invoiced)} · {p.summary.invoiceCount} invoice{p.summary.invoiceCount === 1 ? "" : "s"}
                </div>
                <ProgressBar pct={paidPct} className="mt-3.5" />
              </Card>
            ))}

          {p.invoices.length > 0 && (
            <section>
              <SectionTitle title="Invoices" />
              <div className="mt-2.5 flex flex-col gap-2.5">
                {p.invoices.map((inv) => (
                  <InvoiceCard key={inv.id} inv={inv} />
                ))}
              </div>
            </section>
          )}

          {p.unlinked && (
            <section>
              <SectionTitle title="Not linked to an event yet" sub={`${inr(p.unlinked.summary.balanceDue)} due`} />
              <div className="mt-2.5 flex flex-col gap-2.5">
                {p.unlinked.invoices.map((inv) => (
                  <InvoiceCard key={inv.id} inv={inv} />
                ))}
              </div>
            </section>
          )}

          {p.receipts.length > 0 && (
            <section>
              <SectionTitle title="Receipts" />
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {p.receipts.map((r) => (
                  <ReceiptRow key={r.id} r={r} />
                ))}
              </Card>
            </section>
          )}

          {p.breakdown && (
            <section>
              <SectionTitle title="What you're paying for" sub={p.breakdown.invoiceNumber} />
              <div className="mt-2.5">
                <KeyValue
                  rows={[
                    ...p.breakdown.lines.map((l) => ({ k: l.k, v: inr(l.v) })),
                    ...(p.breakdown.discount > 0 ? [{ k: "Discount", v: `− ${inr(p.breakdown.discount)}` }] : []),
                    ...(p.breakdown.gst > 0 ? [{ k: "GST", v: inr(p.breakdown.gst) }] : []),
                  ]}
                  total={{ k: "Invoice total", v: inr(p.breakdown.total) }}
                />
              </div>
            </section>
          )}

          {(p.invoices.length > 0 || p.unlinked) && (
            <p className="text-center text-meta leading-[1.55] text-[#636368]">
              An invoice is a proforma until it is paid in full. The tax invoice is issued once the balance is cleared.
            </p>
          )}
        </>
      )}

      {reachable && (
        <div className="flex flex-col gap-2">
          <div className="text-center text-detail text-[#6e6e73]">Questions about a payment?</div>
          <ContactLinks contact={contact} context={booking ? `Payments for ${booking.eventName}` : "My payments"} />
          {contact.supportHours && <div className="text-center text-meta text-[#636368]">Support hours: {contact.supportHours}</div>}
        </div>
      )}
    </Screen>
  );
}
