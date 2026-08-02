import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getProjectProcurement } from "@/actions/project-procurement.actions";
import { ProcurementBoard } from "./_components/procurement-board";

export const metadata: Metadata = { title: "Procurement" };

export default async function ProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "projects:read")) redirect("/projects");

  const data = await getProjectProcurement(id);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to venue
      </Link>
      <PageHeader
        title={`Procurement — ${data.project.name}`}
        description="Work packages, purchase orders and live budget variance against the approved CapEx estimate."
      />
      <ProcurementBoard
        projectId={id}
        workPackages={data.workPackages as never}
        purchaseOrders={data.purchaseOrders as never}
        vendors={data.vendors as never}
        variance={data.variance}
        canManage={data.canManage}
      />
    </div>
  );
}
