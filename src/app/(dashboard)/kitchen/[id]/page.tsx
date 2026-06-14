import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getKitchenPlan } from "@/actions/kitchen.actions";
import { KitchenDetail } from "../_components/kitchen-detail";

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

  return <KitchenDetail plan={res.data} canWrite={canWrite} />;
}
