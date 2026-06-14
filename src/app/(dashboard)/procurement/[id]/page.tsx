import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getPurchaseRequisition } from "@/actions/procurement.actions";
import { ProcurementDetail } from "../_components/procurement-detail";

export const metadata: Metadata = { title: "Purchase Requisition" };

export default async function ProcurementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as { id?: string; role?: string };
  if (!user.role || !hasPermission(user.role, "procurement:read")) redirect("/dashboard");

  const canWrite = hasPermission(user.role, "procurement:write");

  const res = await getPurchaseRequisition(id);
  if (!res.success) notFound();

  return (
    <ProcurementDetail pr={res.data} canWrite={canWrite} currentUserId={user.id ?? ""} />
  );
}
