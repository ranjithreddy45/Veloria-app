import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { ComingSoon } from "../_components/coming-soon";

export const metadata: Metadata = { title: "OKR" };

export default async function Page() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) notFound();
  return (
    <ComingSoon
      title="OKR"
      description="Company and team objectives with measurable key results."
      bullets={["Objectives cascade org-chart down", "Key results with progress tracking", "Links to the Performance appraisal cycle"]}
    />
  );
}
