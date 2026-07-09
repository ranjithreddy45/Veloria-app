import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { listKraScorecards } from "@/actions/kra.actions";
import { KraList, type KraScorecardRow } from "./_components/kra-list";

export const metadata: Metadata = { title: "KRA Scorecards" };

// Must mirror KRA_MANAGE_ROLES in kra.actions.ts, else an authorized SALES_HEAD
// sees no "Generate scorecard" button despite being allowed server-side.
const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "BD_HEAD", "SALES_HEAD", "HR_MANAGER"];

export default async function KraScorecardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as { id?: string; role?: string };
  const isManager = !!user.role && MANAGER_ROLES.includes(user.role);

  const listRes = await listKraScorecards();
  const scorecards = (listRes.success ? listRes.data : []) as unknown as KraScorecardRow[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="KRA Scorecards"
        description="Monthly performance scorecards for sales roles — score, incentive gate and final payout %."
      />
      <KraList
        scorecards={scorecards}
        isManager={isManager}
        currentUserId={user.id ?? ""}
      />
    </div>
  );
}
