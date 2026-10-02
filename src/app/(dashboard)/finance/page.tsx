import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions } from "@/components/ui/quick-actions";
import { hasPermission } from "@/lib/permissions";
import {
  getCurrentPeriod, getFinAccounts, getJournalEntries, getTrialBalance,
} from "@/actions/finance.actions";
import { FinanceWorkspace } from "./_components/finance-workspace";
import { NewJournalDialog } from "./_components/new-journal-dialog";

export const metadata = { title: "Finance · Veloria Grand" };

// The roles createManualJournal accepts (FINANCE_ROLES in
// src/actions/finance.actions.ts, a "use server" file that cannot export it).
// Read-only Finance roles such as AUDITOR reach this page with finance:read but
// would only get "Not authorized." on posting, so they are not offered it.
const JOURNAL_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

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
  const seeded = !!period?.seeded;
  const accountOptions = accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }));

  // The page's one action, its create: a journal entry. Only once the ledger
  // is seeded (before that the setup message below owns the page and there is
  // no chart of accounts to post to), and only for the roles that can post.
  // The command centre, cash flow and reports are reached from the sidebar.
  const actions =
    seeded && JOURNAL_ROLES.includes(role) ? (
      <QuickActions leading={<NewJournalDialog accounts={accountOptions} variant="header" />} />
    ) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="General Ledger"
        title="Finance"
        description="General ledger, trial balance and journal entries — double-entry, period-locked."
        actions={actions}
      />

      <FinanceWorkspace
        seeded={seeded}
        period={period ? { fy: period.fy, period: period.period, status: period.status } : null}
        accounts={accountOptions}
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
