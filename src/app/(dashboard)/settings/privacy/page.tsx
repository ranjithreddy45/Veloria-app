import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { listPrivacyRequests, getConsentSummary } from "@/actions/privacy.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIVACY_REQUEST_STATUS_LABEL, type PrivacyRequestStatus } from "@/lib/privacy/policy";
import { PrivacyQueue } from "./_components/privacy-queue";

// ============================================================
// /settings/privacy — DPDP request queue + consent ledger.
// Gated on users:manage-roles (ADMIN / SUPER_ADMIN hold it); the actions
// re-check the same gate, and ROUTE_PERMISSIONS covers the route in
// middleware.
// ============================================================

export const metadata: Metadata = { title: "Privacy & Consent" };

const STATUS_ORDER: PrivacyRequestStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "REJECTED"];

export default async function PrivacySettingsPage() {
  const session = await auth();
  const role = String(session?.user?.role ?? "");
  const allowed =
    role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "users:manage-roles");
  if (!session?.user || !allowed) redirect("/not-authorized");

  const [queue, consent] = await Promise.all([listPrivacyRequests(), getConsentSummary()]);
  if (!queue.success) redirect("/not-authorized");

  const { requests, counts } = queue.data;
  const openCount = counts.OPEN + counts.IN_PROGRESS;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Privacy & Consent"
        icon={ShieldCheck}
        accent="emerald"
        description={
          <>
            Requests raised on the public{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            page, and the consent ledger every public form writes to. Verify the requester first,
            act, then close with a note — the DPDP Act expects a response within 30 days.
          </>
        }
      />

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_ORDER.map((s) => (
          <Card key={s} className="py-4">
            <CardContent className="px-4">
              <p className="text-meta uppercase tracking-wide text-muted-foreground">
                {PRIVACY_REQUEST_STATUS_LABEL[s]}
              </p>
              <p className="numeric mt-1 text-h2 font-semibold text-foreground">{counts[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Queue */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-copy">
            Requests{" "}
            <span className="text-muted-foreground">
              · {openCount} awaiting action
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PrivacyQueue requests={requests} />
        </CardContent>
      </Card>

      {/* Consent ledger */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-copy">Consent ledger</CardTitle>
          <p className="text-body text-muted-foreground">
            Every tick on a public form is recorded with the exact sentence shown, the form it
            came from and a hashed IP — the evidence behind &ldquo;did they agree?&rdquo;.
          </p>
        </CardHeader>
        <CardContent>
          {!consent.success ? (
            <p className="text-body text-muted-foreground">{consent.error}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6 text-body">
                <span>
                  <span className="numeric font-semibold text-foreground">{consent.data.total}</span>{" "}
                  <span className="text-muted-foreground">recorded in total</span>
                </span>
                <span>
                  <span className="numeric font-semibold text-foreground">
                    {consent.data.last30Days}
                  </span>{" "}
                  <span className="text-muted-foreground">in the last 30 days</span>
                </span>
              </div>
              {consent.data.bySource.length === 0 ? (
                <p className="text-body text-muted-foreground">
                  No consent has been recorded yet — it starts the moment a public form is
                  submitted with the checkbox ticked.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="border-b text-left text-meta uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Form</th>
                        <th className="py-2 pr-4 font-medium">Purpose</th>
                        <th className="py-2 pr-4 text-right font-medium">Records</th>
                        <th className="py-2 font-medium">Latest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consent.data.bySource.map((row) => (
                        <tr key={`${row.source}-${row.purpose}`} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium text-foreground">{row.source}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.purpose}</td>
                          <td className="numeric py-2 pr-4 text-right">{row.count}</td>
                          <td className="py-2 text-muted-foreground">
                            {row.latest
                              ? new Date(row.latest).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  timeZone: "Asia/Kolkata",
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
