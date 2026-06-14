import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getAssets, getVenueEventPnl } from "@/actions/finance-assets.actions";
import { AssetsWorkspace } from "./_components/assets-workspace";

export const metadata = { title: "Fixed Assets · Veloria Grand" };

const WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

export default async function FinanceAssetsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const canWrite = WRITE_ROLES.includes(role);

  const [assets, pnl] = await Promise.all([getAssets(), getVenueEventPnl()]);

  return (
    <div className="space-y-6 p-6">
      <AssetsWorkspace assets={assets} pnl={pnl} canWrite={canWrite} />
    </div>
  );
}
