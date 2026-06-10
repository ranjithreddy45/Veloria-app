import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getHallOwner } from "@/actions/hall-owner.actions";
import { PageHeader } from "@/components/layout/page-header";
import { OwnerForm } from "../../_components/owner-form";

export const metadata: Metadata = { title: "Edit Hall Owner" };

export default async function EditOwnerPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "owners:update")) {
    notFound();
  }

  const { ownerId } = await params;
  const [result, bdUsersRaw] = await Promise.all([
    getHallOwner(ownerId),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!result.success || !result.data) notFound();
  const o = result.data;

  // Guard against silently dropping the current assignee: if this owner is
  // assigned to a BD user who is now inactive or has a different role, that
  // user won't be in bdUsersRaw — include them so the select keeps the value.
  let bdUsers = bdUsersRaw;
  if (o.bdOwnerId && !bdUsersRaw.some((u) => u.id === o.bdOwnerId)) {
    const assigned = await prisma.user.findUnique({
      where: { id: o.bdOwnerId },
      select: { id: true, name: true },
    });
    if (assigned) bdUsers = [assigned, ...bdUsersRaw];
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Hall Owner" description={`Editing "${o.ownerName}"`} />
      <div className="mx-auto max-w-3xl">
        <OwnerForm
          bdUsers={bdUsers}
          owner={{
            id: o.id,
            ownerName: o.ownerName,
            companyName: o.companyName ?? "",
            email: o.email ?? "",
            phone: o.phone ?? "",
            whatsapp: o.whatsapp ?? "",
            gstin: o.gstin ?? "",
            propertyCity: o.propertyCity ?? "",
            numberOfHalls: o.numberOfHalls ?? null,
            totalCapacity: o.totalCapacity ?? null,
            propertyType: o.propertyType ?? undefined,
            ownershipStatus: o.ownershipStatus ?? undefined,
            commercialModel: o.commercialModel ?? undefined,
            revenueSharePercent: o.revenueSharePercent
              ? Number(o.revenueSharePercent)
              : null,
            minimumMonthlyGuarantee: o.minimumMonthlyGuarantee
              ? Number(o.minimumMonthlyGuarantee)
              : null,
            contractStatus: o.contractStatus,
            bdOwnerId: o.bdOwnerId ?? "",
            notes: o.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
