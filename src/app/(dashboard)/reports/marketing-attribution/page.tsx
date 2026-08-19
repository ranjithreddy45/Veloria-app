import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getMarketingAttribution } from "@/actions/marketing-report.actions";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Marketing attribution" };
export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default async function MarketingAttributionPage() {
  const res = await getMarketingAttribution();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports · Marketing"
        title="Marketing attribution"
        description="Leads → qualified → booked, by campaign. Pair with Google Ads' cost side for cost-per-qualified-lead and ROAS."
      />

      {!res.success ? (
        <p className="text-sm text-muted-foreground">{res.error}</p>
      ) : res.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
          No leads yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-meta uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 text-right font-medium">Leads</th>
                <th className="px-4 py-3 text-right font-medium">Qualified</th>
                <th className="px-4 py-3 text-right font-medium">Qual. rate</th>
                <th className="px-4 py-3 text-right font-medium">Won</th>
                <th className="px-4 py-3 text-right font-medium">Booking value</th>
                <th className="px-4 py-3 text-right font-medium">Avg booking</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {res.rows.map((r) => (
                <tr key={r.campaignId} className="hover:bg-muted/20">
                  <td className="max-w-[280px] truncate px-4 py-2.5 font-medium" title={r.label}>
                    {r.label}
                  </td>
                  <td className="px-4 py-2.5 text-right numeric">{r.leads}</td>
                  <td className="px-4 py-2.5 text-right numeric">{r.qualified}</td>
                  <td className="px-4 py-2.5 text-right numeric">{pct(r.qualificationRate)}</td>
                  <td className="px-4 py-2.5 text-right numeric">{r.won}</td>
                  <td className="px-4 py-2.5 text-right numeric">
                    {r.bookingValue ? formatINR(r.bookingValue) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right numeric">
                    {r.avgBookingValue ? formatINR(r.avgBookingValue) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-4 py-3">{res.totals.label}</td>
                <td className="px-4 py-3 text-right numeric">{res.totals.leads}</td>
                <td className="px-4 py-3 text-right numeric">{res.totals.qualified}</td>
                <td className="px-4 py-3 text-right numeric">{pct(res.totals.qualificationRate)}</td>
                <td className="px-4 py-3 text-right numeric">{res.totals.won}</td>
                <td className="px-4 py-3 text-right numeric">
                  {res.totals.bookingValue ? formatINR(res.totals.bookingValue) : "—"}
                </td>
                <td className="px-4 py-3 text-right numeric">
                  {res.totals.avgBookingValue ? formatINR(res.totals.avgBookingValue) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
