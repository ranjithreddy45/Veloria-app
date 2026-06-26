import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CalendarCheck } from "lucide-react";

import {
  getSiteVisits,
  getSiteVisitStats,
  getSiteVisitAssignees,
} from "@/actions/site-visit.actions";
import { SiteVisitsBoard } from "./_components/site-visits-board";

// ============================================================
// INTERNAL (gated) — site-visit management board. /site-visits is added to
// INTERNAL_ROUTES + ROUTE_PERMISSIONS (tastings:read). Staff confirm / complete
// / no-show / reassign self-serve visits + tastings here.
// ============================================================

export const metadata: Metadata = {
  title: "Site Visits",
  description: "Manage self-serve venue visits and menu tastings.",
};

export default async function SiteVisitsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!hasPermission(session.user.role as string, "tastings:read")) {
    redirect("/not-authorized");
  }

  const canManage = hasPermission(session.user.role as string, "tastings:update");

  const [upcomingRes, pastRes, statsRes, assigneesRes] = await Promise.all([
    getSiteVisits({ scope: "upcoming" }),
    getSiteVisits({ scope: "past", limit: 100 }),
    getSiteVisitStats(),
    getSiteVisitAssignees(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales · CRM"
        title="Site Visits"
        description="Self-serve venue tours and menu tastings booked from /visit."
        aura
      >
        <a
          href="/visit"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <CalendarCheck className="size-4 text-violet-600" />
          Public scheduler
        </a>
      </PageHeader>

      <SiteVisitsBoard
        initialUpcoming={upcomingRes.success ? upcomingRes.data : []}
        initialPast={pastRes.success ? pastRes.data : []}
        stats={statsRes.success ? statsRes.data : null}
        assignees={assigneesRes.success ? assigneesRes.data : []}
        canManage={canManage}
      />
    </div>
  );
}
