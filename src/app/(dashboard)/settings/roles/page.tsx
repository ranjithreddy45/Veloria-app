import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRolePermissionMatrix } from "@/actions/rbac.actions";
import { PageHeader } from "@/components/layout/page-header";
import { RolesPermissionsMatrix } from "./_components/roles-matrix";
import { acqMatrixForDisplay } from "@/lib/acq/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Roles & Permissions" };

const BD_ROLE_LABELS: Record<string, string> = {
  BD_EXECUTIVE: "BD Exec",
  BD_HEAD: "BD Head",
  OPERATIONS: "Operations",
  LEGAL: "Legal",
};

export default async function RolesPage() {
  const res = await getRolePermissionMatrix();
  if (!res.success) redirect("/not-authorized");

  const bdMatrix = acqMatrixForDisplay();

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

      {/* BD / Acquisition CRM uses a separate, code-managed access matrix. Shown
          here read-only so admins can see who has what (it isn't DB-editable). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">BD / Acquisition CRM access (code-managed)</CardTitle>
          <p className="text-muted-foreground text-sm">
            BD permissions are governed in code, not via the toggles above. Super Admin &amp;
            Admin always have full BD access. This view is read-only.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                  <th className="py-2 pr-4 font-medium">BD capability</th>
                  <th className="py-2 font-medium">Roles with access</th>
                </tr>
              </thead>
              <tbody>
                {bdMatrix.map((row) => (
                  <tr key={row.action} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.label}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {row.roles.map((r) => (
                          <span
                            key={r}
                            className="bg-muted text-foreground/80 rounded-md border px-2 py-0.5 text-xs"
                          >
                            {BD_ROLE_LABELS[r] ?? r}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
