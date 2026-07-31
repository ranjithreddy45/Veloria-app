"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, Sparkles, Scale, BookOpen, ListTree, Trash2, RotateCcw, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatDate } from "@/lib/utils";
import { seedFinance, createManualJournal, reverseEntry } from "@/actions/finance.actions";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

interface Account { id: string; code: string; name: string; type: string }
interface TBRow { code: string; name: string; type: string; debit: number; credit: number }
interface JournalLineV { account: string; debit: number; credit: number; narration: string | null }
interface Entry { id: string; entryNo: string; date: string; narration: string | null; status: string; sourceModule: string; total: number; lines: JournalLineV[] }

export function FinanceWorkspace({
  seeded, period, accounts, entries, trialBalance, canAdmin,
}: {
  seeded: boolean; period: { fy: string; period: number; status: string } | null;
  accounts: Account[]; entries: Entry[];
  trialBalance: { rows: TBRow[]; totalDebit: number; totalCredit: number; balanced: boolean };
  canAdmin: boolean;
}) {
  if (!seeded) {
    return canAdmin ? <SetupPanel /> : (
      <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">Finance hasn’t been set up yet. Ask an admin to initialise the chart of accounts.</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          FY <span className="numeric font-medium text-foreground">{period?.fy}</span> · Period{" "}
          <span className="numeric text-foreground">{period?.period}</span>
          <StatusPill label={period?.status ?? "OPEN"} hue={period?.status === "OPEN" ? "emerald" : "amber"} size="xs" className="ml-2" />
        </div>
        <NewJournalDialog accounts={accounts} />
      </div>

      <Tabs defaultValue="tb">
        <TabsList className={TAB_LIST_SCROLL}>
          <TabsTrigger value="tb" className="gap-1.5"><Scale className="size-3.5" /> Trial balance</TabsTrigger>
          <TabsTrigger value="journal" className="gap-1.5"><BookOpen className="size-3.5" /> Journal</TabsTrigger>
          <TabsTrigger value="coa" className="gap-1.5"><ListTree className="size-3.5" /> Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="tb">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            {/* Debit and Credit are why anyone opens a trial balance, so they
              * hold nowrap and the account name is the column allowed to wrap.
              * Left as-is, a nowrap name plus w-24 + w-40 + w-40 of fixed
              * column hints (344px on its own) shoves both money columns off a
              * 375px screen behind a horizontal scroll. The hints and the cell
              * padding relax below sm:. */}
            <Table className="[&_td]:px-2.5 [&_th]:px-2.5 sm:[&_td]:px-4 sm:[&_th]:px-4">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 [&>th]:h-9 [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-[0.05em] [&>th]:text-muted-foreground">
                  <TableHead className="sm:w-24">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right sm:w-40">Debit</TableHead>
                  <TableHead className="text-right sm:w-40">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalance.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No postings yet. Create a journal entry to see the trial balance.</TableCell></TableRow>
                ) : trialBalance.rows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="numeric text-[12px] text-muted-foreground">{r.code}</TableCell>
                    <TableCell className="whitespace-normal text-[13px]">{r.name}</TableCell>
                    <TableCell className="numeric whitespace-nowrap text-right text-[13px]">{r.debit ? formatINR(r.debit) : ""}</TableCell>
                    <TableCell className="numeric whitespace-nowrap text-right text-[13px]">{r.credit ? formatINR(r.credit) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {trialBalance.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/20 text-[13px] font-semibold">
                    <td className="px-2.5 py-2.5 sm:px-4" colSpan={2}>Total {trialBalance.balanced ? <StatusPill label="Balanced" hue="emerald" size="xs" className="ml-2" /> : <StatusPill label="OUT OF BALANCE" hue="red" size="xs" className="ml-2" />}</td>
                    <td className="numeric whitespace-nowrap px-2.5 py-2.5 text-right sm:px-4">{formatINR(trialBalance.totalDebit)}</td>
                    <td className="numeric whitespace-nowrap px-2.5 py-2.5 text-right sm:px-4">{formatINR(trialBalance.totalCredit)}</td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="journal" className="space-y-2.5">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">No journal entries yet.</div>
          ) : entries.map((e) => <EntryCard key={e.id} entry={e} />)}
        </TabsContent>

        <TabsContent value="coa">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 [&>th]:h-9 [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-[0.05em] [&>th]:text-muted-foreground">
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="numeric text-[12px] text-muted-foreground">{a.code}</TableCell>
                    <TableCell className="text-[13px]">{a.name}</TableCell>
                    <TableCell><StatusPill label={a.type[0] + a.type.slice(1).toLowerCase()} hue="slate" size="xs" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function reverse() {
    const reason = window.prompt("Reason for reversal?");
    if (!reason) return;
    setBusy(true); await reverseEntry(entry.id, reason); setBusy(false); router.refresh();
  }
  return (
    <div className="rounded-2xl border bg-card p-3.5 shadow-card transition-shadow hover:shadow-card-hover sm:p-5">
      {/* Entry no + narration + two status pills on one side and the date +
        * Reverse button on the other is well over 375px, so both groups wrap
        * rather than pushing the card past the viewport. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="numeric text-[12px] text-muted-foreground">{entry.entryNo}</span>
          <span className="text-[13px] font-medium break-words">{entry.narration ?? "—"}</span>
          <StatusPill label={entry.status[0] + entry.status.slice(1).toLowerCase()} hue={entry.status === "POSTED" ? "emerald" : entry.status === "REVERSED" ? "slate" : "amber"} size="xs" />
          <StatusPill label={entry.sourceModule[0] + entry.sourceModule.slice(1).toLowerCase()} hue="violet" size="xs" />
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="numeric">{formatDate(entry.date)}</span>
          {entry.status === "POSTED" && <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground" disabled={busy} onClick={reverse}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Reverse</Button>}
        </div>
      </div>
      <div className="mt-3 space-y-1 border-t pt-2.5">
        {entry.lines.map((l, i) => (
          /* gap-2 and w-24 on a phone: two w-28 money columns plus gap-3 eat
           * 248 of the ~300px inside the card, leaving the account name barely
           * a word. The amount columns keep their full desktop width from sm:. */
          <div key={i} className="flex items-center gap-2 text-[12.5px] sm:gap-3">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.account}</span>
            <span className="numeric w-24 shrink-0 text-right sm:w-28">{l.debit ? formatINR(l.debit) : ""}</span>
            <span className="numeric w-24 shrink-0 text-right sm:w-28">{l.credit ? formatINR(l.credit) : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewJournalDialog({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = React.useState("");
  const [rows, setRows] = React.useState([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);

  const drTotal = rows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0);
  const crTotal = rows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0);
  const balanced = Math.round((drTotal - crTotal) * 100) === 0 && drTotal > 0;

  function setRow(i: number, patch: Partial<{ accountId: string; debit: string; credit: string }>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    setError(null);
    if (!balanced) { setError("Entry must balance (debits = credits) and be non-zero."); return; }
    setBusy(true);
    const res = await createManualJournal({
      date, narration,
      lines: rows.filter((r) => r.accountId && ((parseFloat(r.debit) || 0) > 0 || (parseFloat(r.credit) || 0) > 0))
        .map((r) => ({ accountId: r.accountId, debit: parseFloat(r.debit) || 0, credit: parseFloat(r.credit) || 0 })),
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setRows([{ accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" }]); setNarration("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="size-4" /> New journal entry</Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New journal entry</DialogTitle>
          <DialogDescription>Double-entry: debits must equal credits. Posts straight to the General Ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-[12.5px]">Narration</Label><Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="What is this entry for?" /></div>
          </div>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={r.accountId} onValueChange={(v) => setRow(i, { accountId: v })}>
                  <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={r.debit} onChange={(e) => setRow(i, { debit: e.target.value, credit: "" })} placeholder="Debit" className="numeric h-8 w-28 text-right" />
                <Input value={r.credit} onChange={(e) => setRow(i, { credit: e.target.value, debit: "" })} placeholder="Credit" className="numeric h-8 w-28 text-right" />
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => setRows((rs) => rs.length > 2 ? rs.filter((_, idx) => idx !== i) : rs)}><Trash2 className="size-3.5" /></Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setRows((rs) => [...rs, { accountId: "", debit: "", credit: "" }])}><Plus className="size-3.5" /> Add line</Button>
          </div>
          <div className="flex items-center justify-end gap-6 border-t pt-2 text-[13px]">
            <span className="text-muted-foreground">Debits <span className="numeric font-semibold text-foreground">{formatINR(drTotal)}</span></span>
            <span className="text-muted-foreground">Credits <span className="numeric font-semibold text-foreground">{formatINR(crTotal)}</span></span>
            {balanced ? <StatusPill label="Balanced" hue="emerald" size="sm" /> : <StatusPill label="Not balanced" hue="amber" size="sm" />}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !balanced} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Post entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetupPanel() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  async function run() {
    setBusy(true); const res = await seedFinance(); setBusy(false);
    setMsg(res.success ? `Seeded ${res.data.accounts} accounts. DB balance guard: ${res.data.guard ? "installed ✓" : "app-layer only"}.` : res.error);
    router.refresh();
  }
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div>
      <h3 className="mt-4 text-lg font-semibold">Set up Finance</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Seed the Indian-GAAP chart of accounts, open the current period, and install the database-level balance guard (Σ debits = Σ credits on every posted entry).
      </p>
      <Button onClick={run} disabled={busy} className="mt-5 gap-1.5">{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Set up Finance</Button>
      {msg && <p className="mt-3 text-[13px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
