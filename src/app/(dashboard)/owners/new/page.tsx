import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { OwnerForm } from "../_components/owner-form";

export const metadata: Metadata = { title: "New Hall Owner" };

export default async function NewOwnerPage() {
  const bdUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="New Hall Owner" description="Add a hall owner to the acquisition funnel." />
      <div className="mx-auto max-w-3xl">
        <OwnerForm bdUsers={bdUsers} />
      </div>
    </div>
  );
}
