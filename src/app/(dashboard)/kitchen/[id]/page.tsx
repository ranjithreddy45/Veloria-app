import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getKitchenPlan } from "@/actions/kitchen.actions";
import { KitchenDetail } from "../_components/kitchen-detail";
import { getBookingCovers } from "@/actions/event-covers.actions";
import { CoversPanel } from "@/components/operations/covers-panel";

export const metadata: Metadata = { title: "Kitchen Plan" };

export default async function KitchenPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as { role?: string };
  if (!hasPermission(user.role ?? "", "kitchen:read")) redirect("/");
  const canWrite = hasPermission(user.role ?? "", "kitchen:write");

  const res = await getKitchenPlan(id);
  if (!res.success) notFound();

  // Same reconciliation as the Function Sheet: the plan's covers came from the
  // contracted count at creation; confirmed replies are shown beside it.
  const covers = await getBookingCovers(res.data.bookingId);

  return (
    <div className="space-y-4">
      {covers.success && covers.data.kitchenPlan && (
        <CoversPanel
          target="kitchen"
          targetId={covers.data.kitchenPlan.id}
          covers={covers.data.kitchenPlan.covers}
          coversSource={covers.data.kitchenPlan.coversSource}
          headcount={covers.data.headcount}
          noGuestList={covers.data.noGuestList}
          canEdit={canWrite && res.data.status !== "COMPLETED"}
        />
      )}
      <KitchenDetail plan={res.data} canWrite={canWrite} />
    </div>
  );
}
