import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestDocumentsScreen, type DocumentSection } from "@/actions/guest-payments.actions";
import { getPublicContact } from "@/lib/public/business-contact";
import { formatIstDate } from "@/app/api/guest/receipt/guest-money";
import { isCollectibleInvoice } from "@/lib/finance/issued-invoices";
import { ContactLinks } from "../../../_components/contact-links";
import { Screen, ScreenHeader, Card, Pill, EmptyNote, SectionTitle, Chip, type Tone } from "../../../_components/ui";
import { inr } from "../../../_components/format";

export const dynamic = "force-dynamic";

// ============================================================
// Documents — what the team has actually shared for this booking: e-sign
// requests (the existing /sign flow), contracts, invoices, receipts and sent
// quotations, from the team's own records (guest-payments.actions.ts).
// ============================================================

const shortDate = (iso: string) => formatIstDate(iso, { day: "numeric", month: "short", year: "numeric" });

const SECTION_NAME: Record<DocumentSection, string> = {
  signatures: "e-sign requests",
  contracts: "contracts",
  invoices: "invoices",
  receipts: "receipts",
  quotations: "quotations",
};

function statusTone(status: string): Tone {
  if (status === "SIGNED" || status === "PAID" || status === "COMPLETED") return "green";
  if (status === "SENT" || status === "VIEWED" || status === "OVERDUE" || status === "PENDING") return "amber";
  if (status === "PARTIALLY_PAID") return "plum";
  return "grey";
}

/** One document line: a file tag, title, detail, status and (when it will open) a link. */
function DocRow({
  tag,
  tagClass,
  title,
  meta,
  pill,
  href,
  newTab,
  label,
}: {
  tag: string;
  tagClass: string;
  title: string;
  meta: string;
  pill?: { text: string; tone: Tone };
  href?: string | null;
  newTab?: boolean;
  label?: string | null;
}) {
  const body = (
    <>
      <span className={`flex h-[46px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-black/[.06] text-[9px] font-bold tracking-[.05em] ${tagClass}`}>
        {tag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{title}</span>
        <span className="block truncate text-meta text-[#6e6e73]">{meta}</span>
        {href && label && <span className="mt-0.5 block text-meta font-semibold text-[#6d1b52]">{label}</span>}
      </span>
      {pill && <Pill tone={pill.tone}>{pill.text}</Pill>}
    </>
  );
  const cls = "flex items-center gap-3 px-3.5 py-3";
  if (!href) return <div className={cls}>{body}</div>;
  if (newTab) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  await requireGuest(b ? `/app/event/documents?b=${encodeURIComponent(b)}` : "/app/event/documents");
  const [d, contact] = await Promise.all([getGuestDocumentsScreen(b), getPublicContact()]);
  const booking = d?.booking ?? null;
  const count = d ? d.toSign.length + d.agreements.length + d.invoices.length + d.receipts.length + d.quotations.length : 0;
  const reachable = !!(contact.phone || contact.whatsapp);

  return (
    <Screen className="gap-4 pb-4">
      <ScreenHeader
        title="Documents"
        backHref={booking ? `/app/event?b=${encodeURIComponent(booking.id)}` : "/app/event"}
        sub={booking ? `${booking.eventName} · ${shortDate(booking.date)}` : undefined}
      />

      {d?.preview && (
        <div className="rounded-xl border border-[#b88513]/35 bg-[#faf3e1] px-3.5 py-2.5 text-detail text-[#6e4f0e]">
          <span className="font-semibold">Staff preview.</span> You&apos;re seeing this booking&apos;s documents as its host would; signing is off.
          {d.hiddenInPreview.length > 0 && (
            <> Hidden for your role: {d.hiddenInPreview.map((s) => SECTION_NAME[s]).join(", ")}.</>
          )}
        </div>
      )}
      {d?.invitedBooking && (
        <p className="rounded-xl border border-black/[.08] bg-white px-3.5 py-2.5 text-detail text-[#6e6e73]">
          Documents for {d.invitedBooking.eventName} stay with its host, so they don&apos;t appear in your account.
        </p>
      )}
      {d && d.bookings.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {d.bookings.map((x) => (
            <Chip key={x.id} href={`/app/event/documents?b=${encodeURIComponent(x.id)}`} active={x.id === booking?.id}>
              {x.eventName}
            </Chip>
          ))}
        </div>
      )}

      {!d || (!booking && count === 0) ? (
        <EmptyNote>No booking is linked to this account yet.</EmptyNote>
      ) : (
        <>
          {d.toSign.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-[18px] border border-[#b88513]/35 bg-gradient-to-br from-[#fff8e6] to-[#fdf1cf] p-4">
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[.1em] text-[#b88513]">{s.token ? "Action needed" : "Waiting for signature"}</div>
                <div className="mt-1 text-copy font-semibold">{s.title}</div>
                <div className="mt-0.5 text-detail text-[#6e6e73]">
                  {s.token ? "Review and sign with your phone." : "The booking's host signs this."}
                  {s.sentAt ? ` Sent ${shortDate(s.sentAt)}.` : ""}
                </div>
              </div>
              {s.token && (
                <Link href={`/sign/${encodeURIComponent(s.token)}`} className="rounded-[14px] bg-[#1d1d1f] py-3.5 text-center text-body font-semibold text-white">
                  Review &amp; e-sign
                </Link>
              )}
            </div>
          ))}

          {count === 0 && (
            <EmptyNote>Your agreement, invoices, receipts and quotations collect here as the team shares them.</EmptyNote>
          )}

          {d.agreements.length > 0 && (
            <section>
              <SectionTitle title="Agreements" />
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {d.agreements.map((a) => (
                  <DocRow
                    key={`${a.kind}-${a.id}`}
                    tag="DOC"
                    tagClass="bg-[#f7eef2] text-[#6d1b52]"
                    title={a.title}
                    meta={[a.date ? `${a.status === "SIGNED" ? "Signed" : "Sent"} ${shortDate(a.date)}` : null, a.eventName].filter(Boolean).join(" · ") || "Shared by the team"}
                    pill={{ text: a.statusLabel, tone: statusTone(a.status) }}
                    href={a.href}
                    label={a.hrefLabel}
                  />
                ))}
              </Card>
            </section>
          )}

          {d.invoices.length > 0 && (
            <section>
              <SectionTitle title="Invoices" />
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {d.invoices.map((i) => (
                  <DocRow
                    key={i.id}
                    tag="INV"
                    tagClass="bg-[#e9e9ec] text-[#1d1d1f]"
                    title={`Invoice ${i.number}`}
                    // "due" only on an invoice still owed (finance's owed rule); the pill already says Paid, Refunded or Cancelled.
                    meta={`Issued ${shortDate(i.issued)} · ${inr(i.total)}${isCollectibleInvoice(i.status) && i.balanceDue > 0 ? ` · ${inr(i.balanceDue)} due` : ""}`}
                    pill={{ text: i.statusLabel, tone: statusTone(i.status) }}
                    href={i.downloadUrl}
                    newTab
                    label="Download"
                  />
                ))}
              </Card>
            </section>
          )}

          {d.receipts.length > 0 && (
            <section>
              <SectionTitle title="Receipts" />
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {d.receipts.map((r) => (
                  <DocRow
                    key={r.id}
                    tag="RCP"
                    tagClass="bg-[#e6f6ea] text-[#1b6b41]"
                    title={r.receiptNumber ?? (r.status === "PENDING" ? "Payment proof sent" : "Payment")}
                    meta={`${shortDate(r.date)} · ${r.methodLabel} · ${inr(r.amount)}`}
                    pill={{ text: r.statusLabel, tone: statusTone(r.status) }}
                    href={r.downloadUrl}
                    newTab
                    label="Download"
                  />
                ))}
              </Card>
            </section>
          )}

          {d.quotations.length > 0 && (
            <section>
              <SectionTitle title="Quotations" />
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {d.quotations.map((q) => (
                  <DocRow
                    key={q.id}
                    tag="QUO"
                    tagClass="bg-[#faf3e1] text-[#b88513]"
                    title={`Quotation ${q.number}`}
                    meta={[q.occasion, q.sentAt ? `Sent ${shortDate(q.sentAt)}` : null, inr(q.total)].filter(Boolean).join(" · ")}
                    href={q.href}
                    newTab
                    label="Open"
                  />
                ))}
              </Card>
            </section>
          )}

          {booking && (
            <a href={`/api/guest/calendar/${encodeURIComponent(booking.id)}`} className="vg-card flex items-center gap-3 rounded-2xl px-4 py-3.5 text-body font-semibold text-[#1d1d1f]">
              <CalendarPlus className="size-5 text-[#6d1b52]" aria-hidden />
              <span className="min-w-0 flex-1">Add this event to your calendar</span>
            </a>
          )}

          {d.invoices.length > 0 && (
            <p className="text-center text-meta text-[#636368]">
              An invoice is a proforma until it is paid in full. The tax invoice is issued once the balance is cleared.
            </p>
          )}
        </>
      )}

      {reachable && (
        <div className="flex flex-col gap-2">
          <div className="text-center text-detail text-[#6e6e73]">Need a copy of something else?</div>
          <ContactLinks contact={contact} context={booking ? `Documents for ${booking.eventName}` : "My documents"} />
        </div>
      )}
    </Screen>
  );
}
