import Link from "next/link";
import { Check } from "lucide-react";
import { getPublicHold } from "@/actions/public-hold.actions";
import { HoldCountdown } from "@/app/(public)/hold/_components/availability-calendar";
import { PrimaryButton, KeyValue, EmptyNote } from "../../../../_components/ui";
import { inr, fmtDate } from "../../../../_components/format";

export const metadata = { title: "Your date is held — Veloria Grand" };
export const dynamic = "force-dynamic";

export default async function HeldPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await getPublicHold(token);

  if (!res.success) {
    return (
      <div className="px-6 pt-[calc(var(--sat)+4rem)]">
        <EmptyNote>{res.error}</EmptyNote>
        <Link href="/app/book" className="mt-4 block text-center text-body font-semibold text-[#6d1b52]">Start again</Link>
      </div>
    );
  }
  const h = res.data;
  const live = h.status !== "EXPIRED" && h.status !== "RELEASED";
  const title = !live ? (h.status === "EXPIRED" ? "This hold has lapsed" : "This hold was released") : h.paid ? "Your date is held" : "One step from holding your date";

  return (
    <div className="vg-rise-slow flex flex-col items-center gap-[18px] px-6 pt-[calc(var(--sat)+3.5rem)] text-center">
      <span className={`flex size-[76px] items-center justify-center rounded-full ${live ? "bg-gradient-to-br from-[#f3d489] to-[#b88513] shadow-[0_12px_24px_-12px_rgba(184,133,19,.6)]" : "bg-[#e9e9ec]"}`}>
        <Check className={`size-9 ${live ? "text-white" : "text-[#8a8a8e]"}`} strokeWidth={3} />
      </span>
      <h1 className="font-editorial text-[30px] font-semibold leading-[1.1] tracking-[-.018em]">{title}</h1>
      <p className="max-w-[300px] text-body leading-[1.6] text-[#6e6e73]">
        {!live
          ? "Dates move quickly. Reserve again and we will hold it afresh."
          : h.paid
            ? "A member of our events team will telephone you within two hours to confirm the details and prepare your quotation."
            : `Pay the ${inr(h.tokenAmount)} refundable token to lock ${h.venueName} for you. Until then the slot stays open to others.`}
      </p>

      <div className="w-full text-left">
        <KeyValue
          rows={[
            { k: "Hall", v: h.venueName },
            { k: "Date", v: fmtDate(h.dateISO + "T00:00:00", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) },
            { k: "Slot", v: h.slotLabel },
            { k: "Guests", v: h.guestCount.toLocaleString("en-IN") },
            ...(h.eventType ? [{ k: "Occasion", v: h.eventType }] : []),
          ]}
          total={{ k: h.paid ? "Token paid" : "Token to pay", v: inr(h.tokenAmount) }}
        />
      </div>

      {live && h.expiresAt && (
        <div className="text-detail text-[#b88513]"><HoldCountdown expiresAt={h.expiresAt} /></div>
      )}

      {live && !h.paid && h.invoiceId && (
        <PrimaryButton href={`/pay/${h.invoiceId}`}>Pay {inr(h.tokenAmount)} now</PrimaryButton>
      )}
      {live && h.paid && <PrimaryButton href="/app/event">View my event</PrimaryButton>}
      {!live && <PrimaryButton href="/app/book">Reserve again</PrimaryButton>}
      <Link href="/app" className="py-1.5 text-body font-semibold text-[#6d1b52]">Back to home</Link>
    </div>
  );
}
