import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getObjectives, listOkrOwners } from "@/actions/okr.actions";
import { OkrBoard } from "./_components/okr-board";

export const metadata: Metadata = { title: "OKR" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  const userId = session?.user?.id ?? "";
  if (!hasPermission(role, "hr:read")) notFound();

  const isManager = hasPermission(role, "hr:write") || hasPermission(role, "hr:admin");
  const sp = await searchParams;
  const requestedOwner = isManager && sp.owner ? sp.owner : undefined;
  const ownerId = requestedOwner ?? userId;
  const viewingOther = ownerId !== userId;

  const [objectives, owners] = await Promise.all([
    getObjectives({ ownerId }),
    listOkrOwners(),
  ]);

  const ownerName = objectives[0]?.ownerName ?? owners.find((o) => o.id === ownerId)?.name ?? "Teammate";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People"
        title="OKR"
        description="Objectives with measurable key results. Progress rolls up automatically from each key result."
      />
      <OkrBoard
        objectives={objectives}
        canManage={!viewingOther || isManager}
        viewingOther={viewingOther}
        ownerName={ownerName}
        currentUserId={userId}
        ownerId={ownerId}
        owners={owners}
      />
    </div>
  );
}
