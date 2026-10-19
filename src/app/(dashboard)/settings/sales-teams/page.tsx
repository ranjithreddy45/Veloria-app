import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getSalesTeamSettings } from "@/actions/sales-team.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SalesTeamsManager } from "./_components/sales-teams-manager";

export const metadata: Metadata = { title: "Sales teams | Settings" };
export const dynamic = "force-dynamic";

// ============================================================
// /settings/sales-teams — who is in the Wedding, Corporate and Social teams,
// who heads each, and whether new leads are shared out inside the team
// automatically. Gated on leads:assign (ROUTE_PERMISSIONS); every action
// re-checks it.
// ============================================================

export default async function SalesTeamsSettingsPage() {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "leads:assign")) redirect("/not-authorized");

  const res = await getSalesTeamSettings();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Sales teams"
        eyebrow="Settings · Sales"
        description="Each team works its own leads. A new enquiry goes to a team by its event type, and inside the team to the next rep in turn. Reps see their own team's leads and nothing from the other teams."
      />
      {res.success ? (
        <SalesTeamsManager data={res.data} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-body text-muted-foreground">{res.error}</CardContent>
        </Card>
      )}
    </div>
  );
}
