import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicVisitAvailability } from "@/actions/public-site-visit.actions";
import { VisitScheduler } from "./_components/visit-scheduler";

// ============================================================
// PUBLIC (no auth) — self-serve site-visit / menu-tasting scheduler.
// Lives in the (public) group (inherits its minimal branded shell). NEVER
// added to INTERNAL_ROUTES. Renders only venue names + bookable slot options.
// ============================================================

export const metadata: Metadata = {
  title: "Book a venue visit or menu tasting — Veloria Grand",
  description:
    "Pick a time to tour our venues or taste our menus. Book your visit online in under a minute — our team will confirm by WhatsApp.",
  robots: { index: false, follow: false }, // tokenized booking funnel; keep out of search
  openGraph: {
    title: "Book a venue visit or menu tasting — Veloria Grand",
    description:
      "See the spaces, meet the team, taste the menu. Reserve your visit in under a minute.",
  },
};

export default async function VisitPage() {
  const availability = await getPublicVisitAvailability();

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-foreground text-h1 sm:text-h1">
          Book your visit
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-copy leading-relaxed">
          Tour our venues or taste our menus. Pick a time that works for you —
          we&apos;ll confirm by WhatsApp.
        </p>
      </header>

      {/* Suspense: VisitScheduler reads useSearchParams() (?venue/?kind prefill),
          which requires a CSR boundary for static prerender of this public page. */}
      <Suspense fallback={null}>
        <VisitScheduler
          venues={availability.venues}
          kinds={availability.kinds}
        />
      </Suspense>
    </div>
  );
}
