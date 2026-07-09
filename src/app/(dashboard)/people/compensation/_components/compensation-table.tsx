"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/shared/status-pill";
import type { CompensationOverviewRow } from "@/actions/hr-compensation.actions";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function CompensationTable({ rows }: { rows: CompensationOverviewRow[] }) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(term) ||
      r.empCode.toLowerCase().includes(term) ||
      (r.designation ?? "").toLowerCase().includes(term) ||
      (r.department ?? "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <h3 className="text-[14px] font-semibold">Salary structures</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Every active employee and their current CTC. Open a profile to revise the structure.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, code, role…"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "No active employees yet." : "No employees match your search."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Employee</th>
                <th className="px-3 py-2.5 font-medium">Designation</th>
                <th className="px-3 py-2.5 text-right font-medium">Annual CTC</th>
                <th className="px-3 py-2.5 text-right font-medium">Monthly CTC</th>
                <th className="px-3 py-2.5 text-right font-medium">Basic %</th>
                <th className="px-3 py-2.5 font-medium">Effective</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const hasStructure = r.annualCtc != null;
                return (
                  <tr key={r.employeeId} className="group transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/people/${r.employeeId}`} className="block">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">
                          {r.empCode}
                          {r.department ? ` · ${r.department}` : ""}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{r.designation ?? "—"}</td>
                    {hasStructure ? (
                      <>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{inr(r.annualCtc!)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{inr(r.monthlyCtc!)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.basicPct}%</td>
                        <td className="px-3 py-3 text-muted-foreground">{r.effectiveFrom ? fmtDate(r.effectiveFrom) : "—"}</td>
                      </>
                    ) : (
                      <td className="px-3 py-3 text-left" colSpan={4}>
                        <Link href={`/people/${r.employeeId}`}>
                          <StatusPill label="Set salary" hue="amber" size="xs" />
                        </Link>
                      </td>
                    )}
                    <td className="px-3 py-3 text-right">
                      <Link href={`/people/${r.employeeId}`} className="inline-flex">
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
