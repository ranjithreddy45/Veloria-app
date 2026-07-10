import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import {
  getGratuityLedger,
  getRecentGratuitySettlements,
} from "@/actions/hr-gratuity.actions";
import { formatInr } from "@/app/(dashboard)/people/gratuity/_lib/gratuity-types";
import { GratuityNav } from "../_components/gratuity-nav";
import { AddGratuityForm } from "./_components/add-gratuity-form";

export const metadata: Metadata = { title: "Add Gratuity" };

export default async function AddGratuityPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  // Self-guard: recording a settlement is a compensation write → hr:payroll.
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const [rows, recent] = await Promise.all([
    getGratuityLedger(),
    getRecentGratuitySettlements(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payroll"
        icon={PlusCircle}
        accent="emerald"
        title="Add Gratuity"
        description="Record a manual gratuity settlement or override for an employee. The amount is pre-filled from the shared calculator and remains editable."
      />
      <GratuityNav />

      <AddGratuityForm rows={rows} />

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        <div className="border-b px-5 py-3.5">
          <h3 className="text-[14px] font-semibold">Recently recorded settlements</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Persisted as audit-log entries (action GRATUITY_RECORDED). Newest first, last 25.
          </p>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<PlusCircle />}
            title="No manual settlements yet"
            description="Recorded gratuity settlements will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Settlement date</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Note</th>
                  <th className="px-5 py-2.5 font-medium">Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="font-medium">{s.name || "—"}</div>
                      {s.empCode && (
                        <div className="text-[11.5px] text-muted-foreground">{s.empCode}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {s.settlementDate || "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {formatInr(s.amount)}
                    </td>
                    <td className="max-w-[24ch] truncate px-3 py-3 text-muted-foreground">
                      {s.note ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill label={s.recordedAt.slice(0, 10)} hue="slate" size="xs" noDot />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
