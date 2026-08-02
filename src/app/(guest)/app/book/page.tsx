import { Suspense } from "react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { BookingForm } from "./_components/booking-form";

export const metadata = { title: "Book Your Event — Veloria Grand" };

export default async function BookPage() {
  const venues = await getStorefrontVenues();
  const options = venues.map((v) => ({ id: v.id, name: v.name }));

  return (
    <Suspense
      fallback={
        <div className="px-5 pt-[calc(var(--sat)+1.25rem)] text-body text-muted-foreground">
          Loading…
        </div>
      }
    >
      <BookingForm venues={options} />
    </Suspense>
  );
}
