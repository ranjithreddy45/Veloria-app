import type { Metadata } from "next";
import {
  getPublicConfiguratorCatalog,
  getPublicVenuesForConfigurator,
} from "@/lib/public/configurator-catalog";
import { getPublicQuoteDraft } from "@/actions/public-configurator.actions";
import { Configurator } from "./_components/configurator";

// ============================================================
// /configure — PUBLIC self-serve quote configurator (no auth).
// Route group (public): minimal branded layout, no dashboard chrome.
// ============================================================

export const metadata: Metadata = {
  title: "Plan your event & get an instant quote — Veloria Grand",
  description:
    "Pick your venue, menu, decor and add-ons to see a live price, then pay a small advance to block your date instantly.",
  openGraph: {
    title: "Plan your event & get an instant quote — Veloria Grand",
    description:
      "Build your event package, see a transparent live price, and block your date with a 20% advance.",
  },
};

export default async function ConfigurePage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; resume?: string }>;
}) {
  const { venue, resume } = await searchParams;

  const [venues, resumed] = await Promise.all([
    getPublicVenuesForConfigurator(),
    resume ? getPublicQuoteDraft(resume) : Promise.resolve(null),
  ]);
  const catalog = getPublicConfiguratorCatalog();

  const resumeDraft = resumed && resumed.success ? resumed.data : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Plan your event
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Build your package, see a live price, and block your date with a small advance.
        </p>
      </div>

      <Configurator
        catalog={catalog}
        venues={venues}
        initialVenueId={venue}
        resume={resumeDraft}
      />
    </div>
  );
}
