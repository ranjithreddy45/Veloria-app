import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getProjectVendors } from "@/actions/project-procurement.actions";
import { VendorsAdmin } from "./_components/vendors-admin";

export const metadata: Metadata = { title: "Project Vendors" };

export default async function ProjectVendorsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "projects:read")) redirect("/projects");
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "projects:manage");

  const vendors = await getProjectVendors();

  return (
    <div className="space-y-5">
      <PageHeader title="Project Vendors" description="Your construction & fit-out suppliers — referenced by purchase orders across venues." />
      <VendorsAdmin vendors={vendors as never} canManage={canManage} />
    </div>
  );
}
