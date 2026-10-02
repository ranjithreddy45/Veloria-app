import type { Metadata } from "next";
import { auth } from "@/../auth";
import { getBeos, getBookableEvents, type BeoListItem, type BookableEvent } from "@/actions/beo.actions";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions } from "@/components/ui/quick-actions";
import { BeoDashboard } from "./_components/beo-dashboard";
import { NewFunctionSheetDialog } from "./_components/new-function-sheet-dialog";

export const metadata: Metadata = { title: "Function Sheets (BEO)" };

export default async function BeoListPage() {
  const [listRes, eventsRes, session] = await Promise.all([getBeos(), getBookableEvents(), auth()]);
  const beos = (listRes.success ? listRes.data : []) as BeoListItem[];
  const events = (eventsRes.success ? eventsRes.data : []) as BookableEvent[];
  const role = (session?.user as { role?: string } | undefined)?.role;
  // The same beo:write check createBeo makes on the server.
  const canWrite = !!role && hasPermission(role, "beo:write");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={`Event Operations · ${beos.length} ${beos.length === 1 ? "sheet" : "sheets"}`}
        title="Function Sheets"
        description="Banquet Event Orders (BEO) — the single source of truth for every confirmed event: covers, run-of-show, kitchen, floor, AV and décor briefs, and the day-of incident log."
        actions={
          canWrite ? (
            // The dialog draws its own trigger (the filled primary pill "New
            // function sheet"); a trigger element built here could arrive at
            // the client as a lazy reference, which DialogTrigger asChild
            // renders as nothing. See new-function-sheet-dialog.tsx.
            <QuickActions leading={<NewFunctionSheetDialog events={events} />} />
          ) : undefined
        }
      />
      <BeoDashboard beos={beos} canWrite={canWrite} />
    </div>
  );
}
