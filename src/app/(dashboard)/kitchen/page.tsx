import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions } from "@/components/ui/quick-actions";
import { getKitchenPlans } from "@/actions/kitchen.actions";
import { KitchenList } from "./_components/kitchen-list";
import { NewKitchenPlanDialog } from "./_components/new-kitchen-plan-dialog";

export const metadata: Metadata = { title: "Kitchen / F&B Production" };

export default async function KitchenPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as { role?: string };
  if (!hasPermission(user.role ?? "", "kitchen:read")) redirect("/");
  // The same kitchen:write check createKitchenPlan makes on the server.
  const canWrite = hasPermission(user.role ?? "", "kitchen:write");

  const res = await getKitchenPlans();
  const plans = res.success ? res.data : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={`Event Operations · ${plans.length} ${plans.length === 1 ? "plan" : "plans"}`}
        title="Kitchen / F&B Production"
        description="Plan production per event, build the ingredient indent and track food cost per cover against estimate."
        actions={
          canWrite ? (
            // The dialog draws its own trigger (the filled primary pill "New
            // plan"); a trigger element built here could arrive at the client
            // as a lazy reference, which DialogTrigger asChild renders as
            // nothing. See new-kitchen-plan-dialog.tsx.
            <QuickActions leading={<NewKitchenPlanDialog />} />
          ) : undefined
        }
      />
      <KitchenList plans={plans} canWrite={canWrite} />
    </div>
  );
}
