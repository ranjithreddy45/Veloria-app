import type { Metadata } from "next";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { AvailabilityCalendar } from "./_components/availability-calendar";

// ============================================================
// PUBLIC (no auth) — Availability + instant date-hold landing.
// Inherits the minimal branded header from (public)/layout.tsx.
// ============================================================

export const metadata: Metadata = {
  title: "Check availability & hold your date — Veloria Grand",
  description:
    "See real-time availability across Veloria Grand venues and instantly hold your event date online with a small refundable token.",
  openGraph: {
    title: "Check availability & hold your date — Veloria Grand",
    description:
      "Browse open dates and slots in real time, then hold your date in minutes.",
  },
};

export default async function PublicHoldPage() {
  const venues = await getStorefrontVenues();

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Check availability &amp; hold your date
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Pick a venue and date to see open slots in real time, then hold your
          date instantly with a small token.
        </p>
      </header>

      {venues.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          No venues are open for online booking right now. Please contact us and
          we&apos;ll help you plan your event.
        </div>
      ) : (
        <AvailabilityCalendar
          venues={venues.map((v) => ({
            id: v.id,
            name: v.name,
            capacity: v.capacity,
          }))}
        />
      )}
    </div>
  );
}
