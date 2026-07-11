import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { FEATURES } from "@/config/features";
import { hasPermission } from "@/lib/permissions";

// Shared self-guard for every employee-report page. Mirrors the module-wide
// pattern: HR feature must be on, and the caller must hold hr:read — otherwise
// bounce to /people. Returns nothing; call it first in each page.
export async function guardEmployeeReports(): Promise<void> {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");
}
