import type { Metadata } from "next";
import { auth } from "@/../auth";
import { getDashboardFullData } from "@/actions/dashboard-full.actions";
import { hasPermission } from "@/lib/permissions";
import { sessionAllows, visibleActions } from "@/lib/permission-claims";
import type { HubActionSpec } from "@/components/ui/quick-actions";
import { FullDashboardView } from "./_components/full-dashboard-view";

export const metadata: Metadata = { title: "Dashboard · Veloria Grand" };

export default async function DashboardPage() {
  const [fullData, session] = await Promise.all([getDashboardFullData(), auth()]);

  if (!fullData) {
    return (
      <div className="mx-auto max-w-[62ch] py-10 text-white">
        <h1 className="text-2xl font-bold">The team home is not available for this account.</h1>
        <p className="mt-2 text-slate-400">
          Your role does not include the team dashboard. If that is unexpected, ask an administrator to check your role.
        </p>
      </div>
    );
  }

  const role = (session?.user?.role as string | undefined) ?? "";

  // The hub's shortcuts, in the order the owner approved. Their chip colours
  // come from the destination's module in src/config/modules.ts (the
  // dashboard's anchors: quotations indigo, payments cyan, site visits amber,
  // slot availability pink); "New lead" is the page's primary action.
  //
  // Each pill shows only to someone who can actually open its destination,
  // under the same override-aware rule middleware applies (visibleActions):
  // - the destination's route permission, always;
  // - plus what the destination itself enforces: /leads/new saves through
  //   createLead (leads:create), /quotations/new through createSalesQuotation
  //   (quotes:create), and /site-visits re-checks tastings:read. All three
  //   check the static role matrix, so `when` repeats that check: an override
  //   that middleware honours would still be refused there.
  //
  // Copy: the approved labels and hints in sentence case, except where the
  // approved words promised something the destination does not do. /payments
  // lists payments and records none, so "Record Payment" became "Payments"
  // (owner decision) and its hint "Add client payment" became "Track
  // collections". /availability shows free slots and blocks none, so "New
  // Booking Hold" / "Block a venue slot" became its sidebar title, "Slot
  // availability" / "See free venue slots" (awaiting the owner's sign-off).
  // "Inquiry" is spelt "enquiry" (design spec R16).
  const quickActions = visibleActions<HubActionSpec>(session, [
    {
      href: "/leads/new",
      label: "New lead",
      hint: "Add a new enquiry",
      primary: true,
      permission: "leads:create",
      when: hasPermission(role, "leads:create"),
    },
    {
      href: "/quotations/new",
      label: "Create quotation",
      hint: "Generate proposal",
      permission: "quotes:create",
      when: hasPermission(role, "quotes:create"),
    },
    {
      href: "/payments",
      label: "Payments",
      hint: "Track collections",
    },
    {
      href: "/site-visits",
      label: "Schedule visit",
      hint: "Site visit / tasting",
      when: hasPermission(role, "tastings:read"),
    },
    {
      href: "/availability",
      label: "Slot availability",
      hint: "See free venue slots",
    },
  ]);

  // The Open leads tile links to /leads; only for someone middleware lets in.
  const canOpenLeads = sessionAllows(session, "leads:read");

  return <FullDashboardView data={fullData} quickActions={quickActions} canOpenLeads={canOpenLeads} />;
}
