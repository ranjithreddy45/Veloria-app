"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { QuickActionButton } from "@/components/ui/quick-actions";
import { formatINR } from "@/lib/utils";
import { createManualJournal } from "@/actions/finance.actions";

// ============================================================
// NewJournalDialog: post a manual, balanced journal entry to the GL.
// ------------------------------------------------------------
// The /finance page's main create action. It lives in the page header's
// action cluster, which the page renders only once the ledger is seeded and
// only for the roles createManualJournal accepts; there it asks for the
// filled primary pill (variant="header"). The pill is built here, in the
// client, not passed in from the server page: after the chart of accounts in
// the RSC payload, a server-built element arrives as a lazy Flight reference,
// which DialogTrigger's asChild Slot renders as nothing.
// createManualJournal re-checks the role on the server.
// ============================================================

export interface JournalAccount { id: string; code: string; name: string; type: string }

export function NewJournalDialog({
  accounts,
  variant = "button",
}: {
  /** The chart of accounts the page loaded with getFinAccounts(). */
  accounts: JournalAccount[];
  /**
   * What opens the dialog. "header": the page header's primary pill (a
   * QuickActionButton). "button" (default): a filled "New journal entry"
   * button.
   */
  variant?: "button" | "header";
}) {
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
      <DialogTrigger asChild>
        {variant === "header" ? (
          <QuickActionButton variant="primary" label="New journal entry" hint="Post to the ledger" />
        ) : (
          <Button className="gap-1.5"><Plus className="size-4" /> New journal entry</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New journal entry</DialogTitle>
          <DialogDescription>Double-entry: debits must equal credits. Posts straight to the General Ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-detail">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-detail">Narration</Label><Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="What is this entry for?" /></div>
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
          <div className="flex items-center justify-end gap-6 border-t pt-2 text-body">
            <span className="text-muted-foreground">Debits <span className="numeric font-semibold text-foreground">{formatINR(drTotal)}</span></span>
            <span className="text-muted-foreground">Credits <span className="numeric font-semibold text-foreground">{formatINR(crTotal)}</span></span>
            {balanced ? <StatusPill label="Balanced" hue="emerald" size="sm" /> : <StatusPill label="Not balanced" hue="amber" size="sm" />}
          </div>
        </div>
        {error && <p className="text-copy text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !balanced} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Post entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
