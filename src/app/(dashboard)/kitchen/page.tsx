import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getKitchenPlans } from "@/actions/kitchen.actions";
import { KitchenList } from "./_components/kitchen-list";

export const metadata: Metadata = { title: "Kitchen / F&B Production" };

export default async function KitchenPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as { role?: string };
  if (!hasPermission(user.role ?? "", "kitchen:read")) redirect("/");
  const canWrite = hasPermission(user.role ?? "", "kitchen:write");

  const res = await getKitchenPlans();
  const plans = res.success ? res.data : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kitchen / F&B Production"
        description="Plan production per event, build the ingredient indent and track food cost per cover against estimate."
      />
      <KitchenList plans={plans} canWrite={canWrite} />
    </div>
  );
}
