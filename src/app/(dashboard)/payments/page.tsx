import {
  IndianRupeeIcon,
  ClockIcon,
  CalendarIcon,
} from "lucide-react";
import { getPayments } from "@/actions/payment.actions";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { StatTile } from "@/components/ui/stat-tile";
import { PaymentsTable } from "./_components/payments-table";
import { formatINR } from "@/lib/utils";

export const metadata = {
  title: "Payments",
};

export default async function PaymentsPage() {
  const paymentsResult = await getPayments();

  const payments = paymentsResult.success
    ? paymentsResult.data?.data ?? []
    : [];

  const session = await auth();
  const role = (session?.user?.role as string) ?? "";
  const canCancel = hasPermission(role, "payments:update");
  const isManager = hasPermission(role, "payments:cancel");

  // ---- Derive headline metrics from existing fields (amount/status/paidAt) ----
  const toNumber = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (v == null) return 0;
    const n = Number(typeof v === "string" ? v : (v as { toString(): string }).toString());
    return Number.isFinite(n) ? n : 0;
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let collectedTotal = 0;
  let pendingCount = 0;
  let thisMonth = 0;

  for (const p of payments) {
    const amount = toNumber(p.amount);
    if (p.status === "COMPLETED") {
      collectedTotal += amount;
      const when = p.paidAt ?? p.createdAt;
      if (when && new Date(when) >= monthStart) thisMonth += amount;
    }
    if (p.status === "PENDING" || p.status === "PROCESSING") pendingCount += 1;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={`FINANCE · ${payments.length} payments · ${formatINR(collectedTotal)} collected`}
        title="Payments"
        help={<PageHelp id="payments" />}
        description="Track payment collections, pending and overdue amounts."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Collected"
          value={formatINR(collectedTotal)}
          accent="emerald"
          icon={<IndianRupeeIcon className="size-4" />}
          sub="Completed payments"
        />
        <StatTile
          label="Pending"
          value={pendingCount}
          accent="amber"
          icon={<ClockIcon className="size-4" />}
          sub="Awaiting completion"
        />
        <StatTile
          label="This month"
          value={formatINR(thisMonth)}
          accent="indigo"
          icon={<CalendarIcon className="size-4" />}
          sub="Collected since the 1st"
        />
      </div>

      <PaymentsTable data={payments} canCancel={canCancel} isManager={isManager} />
    </div>
  );
}
