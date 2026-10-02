"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Sparkles, Scale, BookOpen, ListTree, RotateCcw, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatDate } from "@/lib/utils";
import { seedFinance, reverseEntry } from "@/actions/finance.actions";
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
      <div className="rounded-[22px] border border-dashed bg-card/40 p-10 text-center text-body text-muted-foreground">Finance hasn’t been set up yet. Ask an admin to initialise the chart of accounts.</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* "New journal entry" is the page's primary action, in the header's
          action cluster (finance/page.tsx, new-journal-dialog.tsx). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-body text-muted-foreground">
          FY <span className="numeric font-medium text-foreground">{period?.fy}</span> · Period{" "}
          <span className="numeric text-foreground">{period?.period}</span>
          <StatusPill label={period?.status ?? "OPEN"} hue={period?.status === "OPEN" ? "emerald" : "amber"} size="xs" className="ml-2" />
        </div>
      </div>

      <Tabs defaultValue="tb">
        <TabsList className={TAB_LIST_SCROLL}>
          <TabsTrigger value="tb" className="gap-1.5"><Scale className="size-3.5" /> Trial balance</TabsTrigger>
          <TabsTrigger value="journal" className="gap-1.5"><BookOpen className="size-3.5" /> Journal</TabsTrigger>
          <TabsTrigger value="coa" className="gap-1.5"><ListTree className="size-3.5" /> Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="tb">
          <div className="overflow-hidden surface-glass rounded-[22px]">
            {/* Debit and Credit are why anyone opens a trial balance, so they
              * hold nowrap and the account name is the column allowed to wrap.
              * Left as-is, a nowrap name plus w-24 + w-40 + w-40 of fixed
              * column hints (344px on its own) shoves both money columns off a
              * 375px screen behind a horizontal scroll. The hints and the cell
              * padding relax below sm:. */}
            <Table className="[&_td]:px-2.5 [&_th]:px-2.5 sm:[&_td]:px-4 sm:[&_th]:px-4">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 [&>th]:h-9 [&>th]:text-meta [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-[0.05em] [&>th]:text-muted-foreground">
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
                    <TableCell className="numeric text-detail text-muted-foreground">{r.code}</TableCell>
                    <TableCell className="whitespace-normal text-body">{r.name}</TableCell>
                    <TableCell className="numeric whitespace-nowrap text-right text-body">{r.debit ? formatINR(r.debit) : ""}</TableCell>
                    <TableCell className="numeric whitespace-nowrap text-right text-body">{r.credit ? formatINR(r.credit) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {trialBalance.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/20 text-body font-semibold">
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
            <div className="rounded-[22px] border border-dashed bg-card/40 p-10 text-center text-body text-muted-foreground">No journal entries yet.</div>
          ) : entries.map((e) => <EntryCard key={e.id} entry={e} />)}
        </TabsContent>

        <TabsContent value="coa">
          <div className="overflow-hidden surface-glass rounded-[22px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 [&>th]:h-9 [&>th]:text-meta [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-[0.05em] [&>th]:text-muted-foreground">
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="numeric text-detail text-muted-foreground">{a.code}</TableCell>
                    <TableCell className="text-body">{a.name}</TableCell>
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
    <div className="surface-glass rounded-[22px] p-3.5 transition-shadow hover:shadow-card-hover sm:p-5">
      {/* Entry no + narration + two status pills on one side and the date +
        * Reverse button on the other is well over 375px, so both groups wrap
        * rather than pushing the card past the viewport. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="numeric text-detail text-muted-foreground">{entry.entryNo}</span>
          <span className="text-body font-medium break-words">{entry.narration ?? "—"}</span>
          <StatusPill label={entry.status[0] + entry.status.slice(1).toLowerCase()} hue={entry.status === "POSTED" ? "emerald" : entry.status === "REVERSED" ? "slate" : "amber"} size="xs" />
          <StatusPill label={entry.sourceModule[0] + entry.sourceModule.slice(1).toLowerCase()} hue="violet" size="xs" />
        </div>
        <div className="flex items-center gap-2 text-detail text-muted-foreground">
          <span className="numeric">{formatDate(entry.date)}</span>
          {entry.status === "POSTED" && <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground" disabled={busy} onClick={reverse}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Reverse</Button>}
        </div>
      </div>
      <div className="mt-3 space-y-1 border-t pt-2.5">
        {entry.lines.map((l, i) => (
          /* gap-2 and w-24 on a phone: two w-28 money columns plus gap-3 eat
           * 248 of the ~300px inside the card, leaving the account name barely
           * a word. The amount columns keep their full desktop width from sm:. */
          <div key={i} className="flex items-center gap-2 text-detail sm:gap-3">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.account}</span>
            <span className="numeric w-24 shrink-0 text-right sm:w-28">{l.debit ? formatINR(l.debit) : ""}</span>
            <span className="numeric w-24 shrink-0 text-right sm:w-28">{l.credit ? formatINR(l.credit) : ""}</span>
          </div>
        ))}
      </div>
    </div>
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
      {msg && <p className="mt-3 text-body text-muted-foreground">{msg}</p>}
    </div>
  );
}
