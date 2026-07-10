import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import {
  getCurrentPeriod, getFinAccounts, getJournalEntries, getTrialBalance,
} from "@/actions/finance.actions";
import { FinanceWorkspace } from "./_components/finance-workspace";

export const metadata = { title: "Finance · Veloria Grand" };

export default async function FinancePage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const [period, accounts, entries, trialBalance] = await Promise.all([
    getCurrentPeriod(),
    getFinAccounts(),
    getJournalEntries(),
    getTrialBalance(),
  ]);

  const canAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  return (
    <div className="space-y-6 p-6">
      <div className="bg-aura bg-grid-faint -mx-6 -mt-6 rounded-3xl px-6 pb-5 pt-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          <span aria-hidden className="h-3 w-[3px] rounded-full bg-gradient-to-b from-violet-500 to-violet-400" />
          <span className="text-brand-gradient">General Ledger</span>
        </div>
        <h1 className="large-title mt-2 text-[28px] leading-tight text-foreground sm:text-[32px]">
          Finance
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          General ledger, trial balance and journal entries — double-entry, period-locked.
        </p>
      </div>
      <FinanceWorkspace
        seeded={!!period?.seeded}
        period={period ? { fy: period.fy, period: period.period, status: period.status } : null}
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
        entries={entries.map((e) => ({
          id: e.id, entryNo: e.entryNo,
          date: (e.date instanceof Date ? e.date.toISOString() : String(e.date)),
          narration: e.narration, status: e.status, sourceModule: e.sourceModule,
          total: e.total, lines: e.lines,
        }))}
        trialBalance={trialBalance}
        canAdmin={canAdmin}
      />
    </div>
  );
}
