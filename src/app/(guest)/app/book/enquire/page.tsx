import { Suspense } from "react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { BookingForm } from "./booking-form";

export const metadata = { title: "Request a callback — Veloria Grand" };

/** The no-payment route: a callback request instead of an online hold. */
export default async function EnquirePage() {
  const venues = await getStorefrontVenues();
  return (
    <Suspense fallback={<div className="px-5 pt-[calc(var(--sat)+1.25rem)] text-body text-[#6e6e73]">Loading…</div>}>
      <BookingForm venues={venues.map((v) => ({ id: v.id, name: v.name }))} />
    </Suspense>
  );
}
