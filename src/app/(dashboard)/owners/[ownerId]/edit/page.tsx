import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  const { ownerId } = await params;
  const [result, bdUsers] = await Promise.all([
    getHallOwner(ownerId),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!result.success || !result.data) notFound();
  const o = result.data;

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
