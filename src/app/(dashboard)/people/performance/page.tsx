import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getMyPerformance, listCycles, getReviewQueue } from "@/actions/hr-performance.actions";
import { PerformanceHome } from "./_components/performance-home";

export const metadata: Metadata = { title: "Performance" };

export default async function PerformancePage() {
  if (!FEATURES.hr || !FEATURES.hrPerformance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");
  const canAdmin = hasPermission(role, "hr:admin");

  const [mine, cycles, queue] = await Promise.all([getMyPerformance(), listCycles(), getReviewQueue()]);
  const linked = mine && mine.linked !== false ? mine : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Goals & KRAs, self and manager appraisals, and calibration — all tied to the org chart, across the active cycle."
      />
      <PerformanceHome
        employeeId={linked?.employeeId ?? null}
        cycle={(linked?.cycle as never) ?? null}
        goals={(linked?.goals as never) ?? []}
        reviews={(linked?.reviews as never) ?? []}
        cycles={cycles as never}
        reviewQueue={queue.rows as never}
        reviewCycleId={queue.cycle?.id ?? null}
        canAdmin={canAdmin}
      />
    </div>
  );
}
