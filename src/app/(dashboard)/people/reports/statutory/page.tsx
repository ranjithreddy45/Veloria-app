import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Landmark, ShieldCheck, HeartPulse, MapPin, Layers } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { listStatutoryPeriods } from "@/actions/hr-report-statutory.actions";
import { NotFiledBanner, MONTHS } from "./_components/statutory-shared";

export const metadata: Metadata = { title: "Statutory Registers" };

const REGISTERS = [
  {
    href: "/people/reports/statutory/pf",
    title: "PF contribution register",
    desc: "Per-employee UAN/PF no (masked), employee PF, employer EPS/EPF, EDLI, admin — for reconciliation, not the ECR file.",
    icon: ShieldCheck,
    chip: "text-indigo-600 bg-indigo-500/12 dark:text-indigo-300 dark:bg-indigo-400/15",
  },
  {
    href: "/people/reports/statutory/esi",
    title: "ESI contribution register",
    desc: "Per-employee ESI no (masked), employee ESI, employer ESI and total.",
    icon: HeartPulse,
    chip: "text-rose-600 bg-rose-500/12 dark:text-rose-300 dark:bg-rose-400/15",
  },
  {
    href: "/people/reports/statutory/pt",
    title: "Professional Tax register",
    desc: "Per-employee PT, grouped by the entity's PT state, with subtotals and totals.",
    icon: MapPin,
    chip: "text-amber-600 bg-amber-500/15 dark:text-amber-300 dark:bg-amber-400/15",
  },
  {
    href: "/people/reports/statutory/summary",
    title: "Statutory summary",
    desc: "One row per statute (PF ee/er, EPS, EDLI, admin, ESI ee/er, PT, TDS) with the run total for each.",
    icon: Layers,
    chip: "text-emerald-600 bg-emerald-500/12 dark:text-emerald-300 dark:bg-emerald-400/15",
  },
];

export default async function StatutoryReportsIndexPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listStatutoryPeriods();
  const latest = periods[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People · Reports"
        title="Statutory Registers"
        description="Read-only reconciliation registers over locked/paid payroll runs — PF, ESI, PT and a per-statute summary."
        icon={Landmark}
        accent="emerald"
      />

      <NotFiledBanner />

      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
        {latest ? (
          <>
            <span>
              Latest finalised run:{" "}
              <span className="font-medium text-foreground">
                {MONTHS[latest.month]} · FY {latest.fy}
              </span>{" "}
              ({latest.headcount} employees)
            </span>
            <StatusPill label={latest.status} hue={latest.status === "PAID" ? "emerald" : "amber"} size="sm" />
          </>
        ) : (
          <span>No locked or paid payroll runs yet. Lock a run to populate these registers.</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {REGISTERS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group flex items-start gap-3.5 rounded-xl border bg-card p-5 transition-colors hover:border-emerald-500/40 hover:bg-accent/40"
            >
              <span className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl ${r.chip}`} aria-hidden>
                <Icon className="size-[22px]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[14px] font-semibold">{r.title}</h3>
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
