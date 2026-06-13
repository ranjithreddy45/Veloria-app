import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { ComingSoon } from "../_components/coming-soon";

export const metadata: Metadata = { title: "Compensation" };

export default async function Page() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) notFound();
  return (
    <ComingSoon
      title="Compensation"
      description="CTC, revisions, payslips and statutory payroll inputs."
      bullets={["CTC structure + revision history", "PF/ESI/PT/TDS (modelled in statutory now)", "Finance-scoped payroll export"]}
    />
  );
}
