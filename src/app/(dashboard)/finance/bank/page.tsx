import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getFinAccounts } from "@/actions/finance.actions";
import { getBankAccounts, getBankTxns, getReconSummary, getCategorySuggestions } from "@/actions/finance-bank.actions";
import { BankReconcile } from "../_components/bank-reconcile";

export const metadata = { title: "Bank & Reconcile · Veloria Grand" };

export default async function BankPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");
  const canAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const { account: accountParam } = await searchParams;
  const [accounts, allAccounts] = await Promise.all([getBankAccounts(), getFinAccounts()]);
  const active = accounts.find((a) => a.id === accountParam) ?? accounts[0] ?? null;
  const [txns, summary, suggestions] = active
    ? await Promise.all([getBankTxns(active.id), getReconSummary(active.id), getCategorySuggestions(active.id)])
    : [[], { unmatched: 0, matched: 0, reconciled: 0, ignored: 0, statementBalance: 0, glBalance: 0 }, {}];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank &amp; Reconcile</h1>
        <p className="text-sm text-muted-foreground">Import statements, auto-match to the ledger, and categorize what&apos;s left.</p>
      </div>
      <BankReconcile
        canAdmin={canAdmin}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, bankName: a.bankName, accountNo: a.accountNo, gl: `${a.glAccount.code} ${a.glAccount.name}`, txnCount: a._count.txns }))}
        activeId={active?.id ?? null}
        txns={txns.map((t) => ({ ...t, date: (t.date instanceof Date ? t.date.toISOString() : String(t.date)) }))}
        summary={summary}
        suggestions={suggestions}
        accountOptions={allAccounts.map((a) => ({ code: a.code, name: a.name, type: a.type }))}
      />
    </div>
  );
}
