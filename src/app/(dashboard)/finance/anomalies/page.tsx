import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getAnomalies, getAnomalyStats, type AnomalyRow } from "@/actions/finance-anomaly.actions";
import { AnomaliesWorkspace } from "./_components/anomalies-workspace";

export const metadata = { title: "Anomalies · Finance · Veloria Grand" };

type StatusParam = "all" | "open" | "resolved" | "ignored";

const STATUS_MAP: Record<StatusParam, "OPEN" | "RESOLVED" | "IGNORED" | undefined> = {
  all: undefined,
  open: "OPEN",
  resolved: "RESOLVED",
  ignored: "IGNORED",
};

export default async function AnomaliesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");
  const canWrite = role === "SUPER_ADMIN" || role === "ADMIN" || role === "FINANCE";

  const { status: statusParam } = await searchParams;
  const filter: StatusParam =
    statusParam === "open" || statusParam === "resolved" || statusParam === "ignored"
      ? statusParam
      : "all";

  const [anomalies, stats]: [AnomalyRow[], Awaited<ReturnType<typeof getAnomalyStats>>] =
    await Promise.all([getAnomalies(STATUS_MAP[filter]), getAnomalyStats()]);

  return (
    <div className="space-y-6">
      <AnomaliesWorkspace
        canWrite={canWrite}
        anomalies={anomalies}
        stats={stats}
        filter={filter}
      />
    </div>
  );
}
