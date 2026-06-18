import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { getQuotePackages } from "@/actions/quote-catalog.actions";
import { QuoteCatalogManager } from "./_components/quote-catalog-manager";

export const metadata: Metadata = { title: "Quotation Catalog" };

export default async function QuoteCatalogPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "packages:read")) redirect("/not-authorized");

  const [res, vendors] = await Promise.all([
    getQuotePackages(),
    prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const packages = res.success ? res.data : [];
  const canWrite = hasPermission(role, "packages:create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Catalog"
        description="Hall, Food, Decor, Cake, Drinks, Activities & Rooms shown in the quotation builder. Add images and menu options (e.g. welcome-drink choices) per package — reps lock the chosen items per quote."
      />
      <QuoteCatalogManager initialPackages={packages} vendors={vendors} canWrite={canWrite} />
    </div>
  );
}
