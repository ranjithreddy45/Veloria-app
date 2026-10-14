import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { sessionAllows } from "@/lib/permission-claims";
import { listVenueOwners } from "@/actions/venue-owner.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { VenueOwnersManager } from "./_components/venue-owners-manager";

export const metadata: Metadata = { title: "Venue owners | Settings" };
export const dynamic = "force-dynamic";

// ============================================================
// /settings/venue-owners — give a property owner a login to the venue portal
// (/venue-portal) and choose which venues it covers. Gated on
// venue-owners:manage, the same override-aware rule middleware applies to
// this route; every action re-checks it.
// ============================================================

export default async function VenueOwnersPage() {
  const session = await auth();
  if (!sessionAllows(session, "venue-owners:manage")) redirect("/not-authorized");

  const res = await listVenueOwners();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Venue owners"
        eyebrow="Settings · Access"
        description="Owners get their own login, separate from the team app. It shows only lead and booking counts for the venues you choose — never customer names or contact details, and never prices or revenue."
      />
      {res.success ? (
        <VenueOwnersManager owners={res.data.owners} venues={res.data.venues} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-body text-muted-foreground">{res.error}</CardContent>
        </Card>
      )}
    </div>
  );
}
