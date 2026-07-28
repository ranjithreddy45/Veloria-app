"use client";

// ============================================================
// Bank & Reconcile (Finance W4) — import a statement CSV, auto-match to posted
// GL entries on the bank account, and categorize the rest (which posts a JE and
// teaches a rule). API: finance-bank.actions.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, Upload, Wand2, Check, X, Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR, formatDate } from "@/lib/utils";
import {
  createBankAccount, importBankCsv, autoMatchBank, setBankTxnStatus, categorizeBankTxn,
} from "@/actions/finance-bank.actions";

interface Acct { id: string; name: string; bankName: string | null; accountNo: string | null; gl: string; txnCount: number }
interface Txn { id: string; date: string; description: string; reference: string | null; debit: number; credit: number; status: string; matchedEntryId: string | null }
interface Summary { unmatched: number; matched: number; reconciled: number; ignored: number; statementBalance: number; glBalance: number }
interface AcctOpt { code: string; name: string; type: string }

const STATUS_HUE: Record<string, "slate" | "amber" | "emerald" | "blue"> = {
  UNMATCHED: "amber", MATCHED: "blue", RECONCILED: "emerald", IGNORED: "slate",
};

export function BankReconcile({
  canAdmin, accounts, activeId, txns, summary, suggestions, accountOptions,
}: {
  canAdmin: boolean;
  accounts: Acct[];
  activeId: string | null;
  txns: Txn[];
  summary: Summary;
  suggestions: Record<string, { code: string; name: string }>;
  accountOptions: AcctOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [csv, setCsv] = React.useState("");

  async function run<T>(key: string, fn: () => Promise<{ success: boolean; error?: string; data?: T }>, ok: (d?: T) => string) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) return toast.error(res.error);
      toast.success(ok(res.data));
      setCsv("");
      router.refresh();
    } finally { setBusy(null); }
  }

  // ---- No bank account yet ----
  if (accounts.length === 0) {
    return canAdmin ? <CreateAccount onCreate={(d) => run("create", () => createBankAccount(d), () => "Bank account added.")} busy={busy === "create"} /> : (
      <EmptyState icon={<Landmark className="size-5" />} title="No bank account set up" description="Ask an admin to add a bank account to start reconciling." />
    );
  }

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0];
  const matched = txns.filter((t) => t.status === "MATCHED");
  const reconciledPct = summary.reconciled + summary.matched + summary.unmatched + summary.ignored > 0
    ? Math.round(((summary.reconciled + summary.ignored) / (summary.reconciled + summary.matched + summary.unmatched + summary.ignored)) * 100)
    : 0;
  const diff = Math.round((summary.statementBalance - summary.glBalance) * 100) / 100;

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div className="space-y-5">
      {/* Account switcher + summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={active.id} onValueChange={(v) => router.push(`/finance/bank?account=${v}`)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.accountNo ? ` ••${a.accountNo}` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">GL {active.gl}</span>
        {canAdmin && <CreateAccountInline onCreate={(d) => run("create", () => createBankAccount(d), () => "Bank account added.")} busy={busy === "create"} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Statement balance" value={formatINR(summary.statementBalance)} />
        <Stat label="Ledger (GL) balance" value={formatINR(summary.glBalance)} />
        <Stat label="Difference" value={formatINR(diff)} tone={Math.abs(diff) < 0.01 ? "ok" : "warn"} />
        <Stat label="Reconciled" value={`${reconciledPct}%`} sub={`${summary.unmatched} unmatched · ${summary.matched} to confirm`} />
      </div>

      {/* Import */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">Import statement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Upload or paste a CSV with Date, Description, and Debit/Credit (or a signed Amount) columns. Duplicate rows are skipped automatically.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv,text/csv" className="text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
          </div>
          <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder="Date,Narration,Debit,Credit,Ref&#10;01/04/2026,NEFT FROM ACME,,118000.00,UTR123" className="numeric text-xs" />
          <div className="flex gap-2">
            <Button disabled={!csv.trim() || busy === "import"} onClick={() => run("import", () => importBankCsv(active.id, csv), (d) => { const r = d as { imported: number; skipped: number; duplicates: number } | undefined; return `Imported ${r?.imported ?? 0} (${r?.duplicates ?? 0} dup, ${r?.skipped ?? 0} skipped).`; })}>
              {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import
            </Button>
            <Button variant="outline" disabled={busy === "match" || summary.unmatched === 0} onClick={() => run("match", () => autoMatchBank(active.id), (d) => `Auto-matched ${(d as { matched: number } | undefined)?.matched ?? 0}.`)}>
              {busy === "match" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Auto-match
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      {txns.length === 0 ? (
        <EmptyState icon={<Landmark className="size-5" />} title="No transactions yet" description="Import a statement to begin." />
      ) : (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(t.date)}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm" title={t.description}>{t.description}</TableCell>
                    <TableCell className="text-right numeric text-rose-600">{t.debit > 0 ? formatINR(t.debit) : "—"}</TableCell>
                    <TableCell className="text-right numeric text-emerald-600">{t.credit > 0 ? formatINR(t.credit) : "—"}</TableCell>
                    <TableCell><StatusPill label={t.status.toLowerCase()} hue={STATUS_HUE[t.status]} size="xs" /></TableCell>
                    <TableCell className="text-right">
                      {t.status === "MATCHED" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" disabled={busy === t.id} onClick={() => run(t.id, () => setBankTxnStatus(t.id, "RECONCILED"), () => "Reconciled.")}><Check className="size-3.5" /> Confirm</Button>
                          <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => run(t.id, () => setBankTxnStatus(t.id, "UNMATCHED"), () => "Unmatched.")}><X className="size-3.5" /></Button>
                        </div>
                      )}
                      {t.status === "UNMATCHED" && (
                        <div className="flex items-center justify-end gap-1">
                          {suggestions[t.id] && <span className="hidden items-center gap-0.5 text-[10px] text-violet-600 sm:inline-flex"><Sparkles className="size-3" />{suggestions[t.id].code}</span>}
                          <Select disabled={busy === t.id} onValueChange={(code) => run(t.id, () => categorizeBankTxn(t.id, code), (d) => `Posted ${(d as { entryNo: string } | undefined)?.entryNo ?? ""}.`)} defaultValue={suggestions[t.id]?.code}>
                            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Categorize…" /></SelectTrigger>
                            <SelectContent>
                              {accountOptions.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} {a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => run(t.id, () => setBankTxnStatus(t.id, "IGNORED"), () => "Ignored.")} title="Ignore">×</Button>
                        </div>
                      )}
                      {t.status === "RECONCILED" && <span className="text-xs text-emerald-600">✓</span>}
                      {t.status === "IGNORED" && (
                        <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => run(t.id, () => setBankTxnStatus(t.id, "UNMATCHED"), () => "Restored.")}>Restore</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {matched.length > 0 && <p className="px-4 py-2 text-xs text-muted-foreground">{matched.length} auto-matched — review and confirm.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold numeric ${tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CreateAccountInline({ onCreate, busy }: { onCreate: (d: { name: string; bankName?: string; accountNo?: string; openingBalance?: number }) => void; busy: boolean }) {
  const [open, setOpen] = React.useState(false);
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Add account</Button>;
  return <InlineForm onCancel={() => setOpen(false)} onCreate={onCreate} busy={busy} />;
}

function CreateAccount({ onCreate, busy }: { onCreate: (d: { name: string; bankName?: string; accountNo?: string; openingBalance?: number }) => void; busy: boolean }) {
  return (
    <Card className="mx-auto max-w-md border-0 shadow-card">
      <CardHeader><CardTitle className="text-base">Add a bank account</CardTitle></CardHeader>
      <CardContent><InlineForm onCreate={onCreate} busy={busy} /></CardContent>
    </Card>
  );
}

function InlineForm({ onCreate, busy, onCancel }: { onCreate: (d: { name: string; bankName?: string; accountNo?: string; openingBalance?: number }) => void; busy: boolean; onCancel?: () => void }) {
  const [name, setName] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [accountNo, setAccountNo] = React.useState("");
  const [opening, setOpening] = React.useState("");
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label className="text-xs">Account name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Current — HDFC" /></div>
        <div><Label className="text-xs">Bank</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" /></div>
        <div><Label className="text-xs">Last 4 / masked</Label><Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="1234" /></div>
        <div><Label className="text-xs">Opening balance (₹)</Label><Input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" placeholder="0" /></div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!name.trim() || busy} onClick={() => onCreate({ name, bankName: bankName || undefined, accountNo: accountNo || undefined, openingBalance: parseFloat(opening) || 0 })}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
        </Button>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}
