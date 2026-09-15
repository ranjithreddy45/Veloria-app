import { redirect } from "next/navigation";
import { TrendingUpIcon } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { resolveBdRange } from "@/lib/acq/analytics-range";
import {
  getEventProfitability,
  getProfitabilityVenues,
  type ProfitabilityStatusFilter,
} from "@/actions/finance-profitability.actions";
import { EventProfitabilityReport } from "./_components/event-profitability-report";

export const metadata = { title: "Event Profitability · Veloria Grand" };

const STATUS_FILTERS = new Set<string>(["ACTIVE", "ALL", "HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export default async function EventProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; venue?: string; status?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const sp = await searchParams;
  // Default = this month, IST-anchored (the team's calendar, not the server's).
  const thisMonth = resolveBdRange("month");
  const from = sp.from && YMD.test(sp.from) ? sp.from : thisMonth.fromDate;
  const to = sp.to && YMD.test(sp.to) ? sp.to : thisMonth.toDate;
  const venueId = sp.venue || undefined;
  const status = (sp.status && STATUS_FILTERS.has(sp.status) ? sp.status : "ACTIVE") as ProfitabilityStatusFilter;

  const [report, venues] = await Promise.all([
    getEventProfitability({ from, to, venueId, status }),
    getProfitabilityVenues(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUpIcon}
        accent="gold"
        eyebrow="Finance · Reports"
        title="Event Profitability"
        description="Per-event margin by event date: invoiced (accrual) and collected (cash) revenue against vendor, commission and referral costs — paid vs committed, with the gaps called out."
      />
      <EventProfitabilityReport
        filters={{ from, to, venueId: venueId ?? "", status }}
        venues={venues.success ? venues.data : []}
        report={report.success ? report.data : null}
        error={report.success ? null : report.error}
      />
    </div>
  );
}
