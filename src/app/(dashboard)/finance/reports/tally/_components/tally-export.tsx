"use client";

// ============================================================
// Tally export form — date range (defaults to the current FY), what to
// export, company name, one download button. The XML is built server-side
// by a finance:read-gated action; the file itself is assembled here as a
// Blob so nothing is written to disk on the server.
// ============================================================

import * as React from "react";
import { Download, BookOpen, ListOrdered, Layers, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { buildTallyExport, type TallyExportDefaults, type TallyExportData } from "@/actions/finance-tally.actions";
import type { TallyExportKind } from "@/lib/finance/tally-xml";

const KIND_LABEL: Record<TallyExportKind, string> = {
  both: "Masters + vouchers (two files)",
  vouchers: "Vouchers only",
  masters: "Ledger masters only",
};

function downloadXml(filename: string, xml: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileNames(data: TallyExportData): { masters: string; vouchers: string } {
  const base = `Veloria-Tally-${data.from}-${data.to}`;
  const both = data.masters !== null && data.vouchers !== null;
  return {
    masters: both ? `${base}-masters.xml` : `${base}.xml`,
    vouchers: both ? `${base}-vouchers.xml` : `${base}.xml`,
  };
}

function deliver(data: TallyExportData) {
  const names = fileNames(data);
  if (data.masters !== null) downloadXml(names.masters, data.masters);
  if (data.vouchers !== null) downloadXml(names.vouchers, data.vouchers);
}

export function TallyExport({ defaults }: { defaults: TallyExportDefaults }) {
  const [from, setFrom] = React.useState(defaults.from);
  const [to, setTo] = React.useState(defaults.to);
  const [kind, setKind] = React.useState<TallyExportKind>("both");
  const [companyName, setCompanyName] = React.useState(defaults.companyName);
  const [result, setResult] = React.useState<TallyExportData | null>(null);
  const [pending, startTransition] = React.useTransition();

  const run = () => {
    startTransition(async () => {
      const res = await buildTallyExport({ from, to, kind, companyName });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      deliver(res.data);
      const c = res.data.counts;
      toast.success(`Tally XML ready — ${c.entries} entries, ${c.lines} lines, ${c.ledgers} ledgers.`);
    });
  };

  const names = result ? fileNames(result) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-body">What to export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tally-from" className="text-meta text-muted-foreground">From</Label>
                <Input id="tally-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tally-to" className="text-meta text-muted-foreground">To</Label>
                <Input id="tally-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="numeric" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-meta text-muted-foreground">Export</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as TallyExportKind)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABEL) as TallyExportKind[]).map((k) => (
                      <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tally-company" className="text-meta text-muted-foreground">Tally company name</Label>
                <Input id="tally-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Exactly as it appears in Tally" />
              </div>
            </div>
            <p className="text-detail text-muted-foreground">
              Defaults to the current financial year. Only posted entries are included — drafts never leave the app.
              The company name must match the company open in Tally, or Tally will refuse the file.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={run} disabled={pending || !from || !to}>
                <Download className="mr-2 h-4 w-4" />
                {pending ? "Building…" : "Download Tally XML"}
              </Button>
              {result && names ? (
                <Button variant="outline" onClick={() => deliver(result)} disabled={pending}>
                  Download again
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {result ? (
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Journal entries" value={result.counts.entries} accent="gold" icon={<ListOrdered className="size-4" />} sub="one voucher each" />
              <StatTile label="Journal lines" value={result.counts.lines} accent="emerald" icon={<Layers className="size-4" />} sub="ledger entries" />
              <StatTile label="Ledgers used" value={result.counts.ledgers} accent="cyan" icon={<BookOpen className="size-4" />} sub="masters in the file" />
            </div>
            <p className="text-meta text-muted-foreground">
              <span className="numeric">{result.from}</span> → <span className="numeric">{result.to}</span>
              {names && result.masters !== null ? <> · masters: <span className="numeric">{names.masters}</span></> : null}
              {names && result.vouchers !== null ? <> · vouchers: <span className="numeric">{names.vouchers}</span></> : null}
            </p>
          </div>
        ) : null}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Info className="size-4 text-muted-foreground" />
            How to import in Tally Prime
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-detail">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open the company in Tally Prime and take a backup first.</li>
            <li>Import the <strong>masters</strong> file: Gateway of Tally → Import → Masters → pick the file. Choose <em>Ignore duplicates</em> if the ledgers already exist.</li>
            <li>Import the <strong>vouchers</strong> file: Gateway of Tally → Import → Vouchers → pick the file.</li>
            <li>Check Display → Statements of Accounts → Statistics; the voucher count should match the entries figure shown here.</li>
          </ol>
          <div className="space-y-1.5 text-meta text-muted-foreground">
            <p>Ledgers are named <span className="numeric">code name</span> (e.g. 1020 Bank - Current Account) and placed under standard Tally groups: debtors, creditors, bank, cash, duties &amp; taxes, sales, direct and indirect expenses.</p>
            <p>Vouchers are typed from their lines: cash or bank in → Receipt, out → Payment, debtor vs revenue → Sales, creditor vs expense → Purchase, otherwise Journal. GST is exported as its own ledger line, not split into CGST/SGST.</p>
            <p>Import a date range only once — Tally does not de-duplicate vouchers on re-import.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
