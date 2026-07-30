import {
  IndianRupeeIcon,
  ClockIcon,
  CalendarIcon,
  CreditCardIcon,
} from "lucide-react";
import { getPayments } from "@/actions/payment.actions";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { StatTile } from "@/components/ui/stat-tile";
import { PaymentsTable } from "./_components/payments-table";
import { PaymentGatewayStatus } from "./_components/gateway-status";
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
  const canConfigurePayments = hasPermission(role, "payments:create");

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
        icon={CreditCardIcon}
        accent="emerald"
        eyebrow={
          <span>
            FINANCE · <span className="numeric">{payments.length}</span> payment
            {payments.length === 1 ? "" : "s"} ·{" "}
            <span className="numeric">{formatINR(collectedTotal)}</span> collected
          </span>
        }
        title="Payments"
        help={<PageHelp id="payments" />}
        description="Track payment collections, pending and overdue amounts."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Collected"
          value={<span className="numeric">{formatINR(collectedTotal)}</span>}
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
          value={<span className="numeric">{formatINR(thisMonth)}</span>}
          accent="indigo"
          icon={<CalendarIcon className="size-4" />}
          sub="Collected since the 1st"
        />
      </div>

      {canConfigurePayments && <PaymentGatewayStatus />}

      <PaymentsTable data={payments} canCancel={canCancel} isManager={isManager} />
    </div>
  );
}
