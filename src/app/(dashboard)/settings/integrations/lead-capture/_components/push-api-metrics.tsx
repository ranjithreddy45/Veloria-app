import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PushApiMetricsData, PushApiWindowMetrics } from "@/actions/push-api-metrics.actions";

interface Props {
  metrics: PushApiMetricsData;
}

const ROWS: { key: keyof PushApiWindowMetrics; label: string; tone?: "bad" }[] = [
  { key: "total", label: "Requests" },
  { key: "created", label: "Leads created" },
  { key: "updated", label: "Existing leads updated" },
  { key: "duplicate", label: "Duplicates (no change)" },
  { key: "replayed", label: "Idempotent replays" },
  { key: "rejected", label: "Rejected", tone: "bad" },
  { key: "validationErrors", label: "Validation errors", tone: "bad" },
  { key: "authFailures", label: "Auth failures", tone: "bad" },
  { key: "rateLimited", label: "Rate limited / lead cap", tone: "bad" },
  { key: "serverErrors", label: "Server errors", tone: "bad" },
];

const fmt = (v: number | null) => (v == null ? "—" : v.toLocaleString("en-IN"));
const ms = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("en-IN")} ms`);

export function PushApiMetrics({ metrics }: Props) {
  const { last24h, last7d, byKey24h } = metrics;
  const empty = last7d.total === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Push API — last 24 hours / 7 days</CardTitle>
        <CardDescription>
          Traffic on <code>/api/v1/push/leads</code>, from the request log. Counts only; no addresses or client details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No Push API requests in the last 7 days.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Push API request counts and latency for the last 24 hours and 7 days</caption>
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
                    <th scope="col" className="py-2 px-3 text-right font-medium">24 hours</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">7 days</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => {
                    const a = last24h[row.key] as number;
                    const b = last7d[row.key] as number;
                    return (
                      <tr key={row.key} className="border-b border-border/40">
                        <th scope="row" className="py-1.5 pr-3 text-left font-normal">{row.label}</th>
                        <td className={`py-1.5 px-3 text-right tabular-nums ${row.tone === "bad" && a > 0 ? "text-destructive" : ""}`}>
                          {fmt(a)}
                        </td>
                        <td className={`py-1.5 pl-3 text-right tabular-nums ${row.tone === "bad" && b > 0 ? "text-destructive" : ""}`}>
                          {fmt(b)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-border/40">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">Latency p50</th>
                    <td className="py-1.5 px-3 text-right tabular-nums">{ms(last24h.p50Ms)}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{ms(last7d.p50Ms)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">Latency p95</th>
                    <td className="py-1.5 px-3 text-right tabular-nums">{ms(last24h.p95Ms)}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{ms(last7d.p95Ms)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">By key — last 24 hours</p>
              {byKey24h.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests in the last 24 hours.</p>
              ) : (
                byKey24h.map((k) => (
                  <div
                    key={k.apiKeyPrefix ?? "unknown"}
                    className="flex flex-wrap items-center justify-between gap-2 border border-border/50 rounded-lg p-2.5"
                  >
                    <span className="font-mono text-xs">
                      {k.apiKeyPrefix ? `${k.apiKeyPrefix}••••••••` : "No valid key"}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{fmt(k.count)} requests</Badge>
                      <Badge
                        variant="outline"
                        className={
                          k.errors > 0
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-success/10 text-success border-success/20"
                        }
                      >
                        {fmt(k.errors)} errors
                      </Badge>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
