import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { PortalShell } from "./_components/portal-shell";
import { getPortalScope } from "./_lib/scope";

export const metadata: Metadata = { title: "Venue Portal" };

// ============================================================
// Venue owner portal — layout.
// ------------------------------------------------------------
// A venue owner is someone outside the company. Middleware already limits
// /venue-portal to VENUE_OWNER (and admins, who get a preview); the checks
// below repeat that on the server so no page relies on it. The scope (the
// owner's venues, from VenueOwnerAccess) is fetched once per request and
// shared with the page through getPortalScope's cache.
// ============================================================

export default async function VenuePortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/venue-portal");

  const scope = await getPortalScope();
  if (!scope) redirect("/not-authorized");

  return (
    <PortalShell preview={scope.preview} userName={scope.name || "Venue owner"}>
      {children}
    </PortalShell>
  );
}
