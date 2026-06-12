import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRolePermissionMatrix } from "@/actions/rbac.actions";
import { PageHeader } from "@/components/layout/page-header";
import { RolesPermissionsMatrix } from "./_components/roles-matrix";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  const res = await getRolePermissionMatrix();
  if (!res.success) redirect("/not-authorized");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Roles & Permissions"
        description="Control exactly what each role can access. Super Admin and Admin always have full access. Changes take effect on a user's next sign-in."
      />
      <RolesPermissionsMatrix
        roles={res.data.roles}
        permissions={res.data.permissions}
        effective={res.data.effective}
      />
    </div>
  );
}
