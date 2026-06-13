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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
        <p className="text-sm text-muted-foreground">
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
