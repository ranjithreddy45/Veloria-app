import type { Metadata } from "next";
import { auth } from "@/../auth";
import { getBeos, getBookableEvents, type BeoListItem, type BookableEvent } from "@/actions/beo.actions";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { BeoDashboard } from "./_components/beo-dashboard";

export const metadata: Metadata = { title: "Function Sheets (BEO)" };

export default async function BeoListPage() {
  const [listRes, eventsRes, session] = await Promise.all([getBeos(), getBookableEvents(), auth()]);
  const beos = (listRes.success ? listRes.data : []) as BeoListItem[];
  const events = (eventsRes.success ? eventsRes.data : []) as BookableEvent[];
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canWrite = !!role && hasPermission(role, "beo:write");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        aura
        eyebrow={`Event Operations · ${beos.length} ${beos.length === 1 ? "sheet" : "sheets"}`}
        title="Function Sheets"
        description="Banquet Event Orders (BEO) — the single source of truth for every confirmed event: covers, run-of-show, kitchen, floor, AV and décor briefs, and the day-of incident log."
      />
      <BeoDashboard beos={beos} events={events} canWrite={canWrite} />
    </div>
  );
}
