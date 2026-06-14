import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getDispatches, getBookableEvents } from "@/actions/logistics.actions";
import { PageHeader } from "@/components/layout/page-header";
import { DispatchBoard } from "./_components/dispatch-board";

export const metadata: Metadata = { title: "Logistics & Dispatch" };

// ============================================================
// Logistics list page — equipment-dispatch board.
// Gated to logistics:read; writes flow through logistics:write.
// ============================================================
export default async function LogisticsPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !hasPermission(role, "logistics:read")) redirect("/dashboard");

  const canWrite = hasPermission(role, "logistics:write");
  const [dispatchesRes, eventsRes] = await Promise.all([
    getDispatches(),
    canWrite
      ? getBookableEvents()
      : Promise.resolve<Awaited<ReturnType<typeof getBookableEvents>>>({ success: true, data: [] }),
  ]);

  const dispatches = dispatchesRes.success ? dispatchesRes.data : [];
  const events = eventsRes.success ? eventsRes.data : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Logistics & Dispatch"
        eyebrow={`Equipment dispatch · ${dispatches.length} orders`}
        description="Plan, dispatch, deliver and reconcile returns of equipment for your events."
      />
      <DispatchBoard dispatches={dispatches} events={events} canWrite={canWrite} />
    </div>
  );
}
