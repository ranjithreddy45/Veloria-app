import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getDispatch } from "@/actions/logistics.actions";
import { DispatchDetail } from "../_components/dispatch-detail";

export const metadata: Metadata = { title: "Dispatch Order" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DispatchDetailPage({ params }: PageProps) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !hasPermission(role, "logistics:read")) redirect("/dashboard");

  const { id } = await params;
  const res = await getDispatch(id);
  if (!res.success) notFound();

  const canWrite = hasPermission(role, "logistics:write");

  return (
    <div className="space-y-6">
      <DispatchDetail dispatch={res.data} canWrite={canWrite} />
    </div>
  );
}
