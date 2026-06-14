"use client";

// ============================================================
// Finance — Tax & Compliance workspace (client). FY picker + StatTiles +
// GSTR-3B / GSTR-1 / TDS tabs. Pure presentation; every figure is derived
// server-side from the posted ledger and the Invoice table.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Receipt, ArrowDownToLine, Wallet, Landmark, FileText, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR } from "@/lib/utils";
import type { TaxSummary } from "@/actions/finance-tax.actions";

const STATUS_HUE: Record<string, "emerald" | "amber" | "blue" | "rose" | "slate"> = {
  PAID: "emerald",
  PARTIALLY_PAID: "amber",
  SENT: "blue",
  OVERDUE: "rose",
};

function SummaryRow({ label, value, hint, strong, tone }: { label: string; value: number; hint?: string; strong?: boolean; tone?: "emerald" | "rose" }) {
  return (
    <TableRow className={strong ? "border-t-2 font-semibold" : undefined}>
      <TableCell className="text-sm">
        {label}
        {hint && <span className="ml-2 text-[11px] text-muted-foreground">{hint}</span>}
      </TableCell>
      <TableCell className={`text-right tabular-nums ${tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : ""}`}>
        {formatINR(value)}
      </TableCell>
    </TableRow>
  );
}

export function TaxWorkspace({ summary, fiscalYears }: { summary: TaxSummary; fiscalYears: string[] }) {
  const router = useRouter();
  const { gstr3b, tds, gstr1, fy } = summary;
  const netLabel = gstr3b.netPayable >= 0 ? "Net GST payable" : "Net ITC carried forward";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Financial year</span>
        <Select value={fy} onValueChange={(v) => router.push(`/finance/tax?fy=${v}`)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{fiscalYears.map((y) => <SelectItem key={y} value={y}>FY {y}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">Figures are derived live from the posted ledger.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Output GST" accent="amber" icon={<Receipt className="size-4" />} value={formatINR(gstr3b.outputGst)} sub="Liability · GST collected" />
        <StatTile label="Input tax credit" accent="emerald" icon={<ArrowDownToLine className="size-4" />} value={formatINR(gstr3b.inputCredit)} sub="ITC available" />
        <StatTile label={netLabel} accent="rose" icon={<Wallet className="size-4" />} value={formatINR(Math.abs(gstr3b.netPayable))} sub="Output − Input" />
        <StatTile label="TDS payable" accent="violet" icon={<Landmark className="size-4" />} value={formatINR(tds.payable)} sub="Deducted, to remit" />
      </div>

      <Tabs defaultValue="gstr3b">
        <TabsList>
          <TabsTrigger value="gstr3b"><Scale className="size-4" /> GSTR-3B</TabsTrigger>
          <TabsTrigger value="gstr1"><FileText className="size-4" /> GSTR-1</TabsTrigger>
          <TabsTrigger value="tds"><Landmark className="size-4" /> TDS</TabsTrigger>
        </TabsList>

        {/* GSTR-3B — net GST summary */}
        <TabsContent value="gstr3b">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">GSTR-3B summary · FY {fy}</CardTitle></CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Particulars</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  <SummaryRow label="Output GST (tax collected on outward supplies)" hint="Cr · acct 2100" value={gstr3b.outputGst} />
                  <SummaryRow label="Input Tax Credit (GST on inward supplies)" hint="Dr · acct 1200" value={gstr3b.inputCredit} />
                  <SummaryRow label={netLabel} hint="Output − Input" value={Math.abs(gstr3b.netPayable)} strong tone={gstr3b.netPayable >= 0 ? "rose" : "emerald"} />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GSTR-1 — invoice-wise outward supplies */}
        <TabsContent value="gstr1">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Outward supplies (B2B/B2C) · FY {fy}</CardTitle></CardHeader>
            <CardContent className="px-0">
              {gstr1.invoices.length === 0 ? (
                <EmptyState icon={<FileText className="size-5" />} title="No outward supplies" description="No SENT or PAID invoices in this financial year. GSTR-1 is built from issued invoices." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>GSTIN / Place</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gstr1.invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{inv.invoiceNumber}</span>
                            <StatusPill label={inv.status.replace(/_/g, " ")} hue={STATUS_HUE[inv.status] ?? "slate"} size="sm" />
                          </div>
                          <span className="text-[11px] text-muted-foreground">{new Date(inv.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="tabular-nums">{inv.gstin ?? <span className="text-muted-foreground">Unregistered</span>}</div>
                          <span className="text-[11px] text-muted-foreground">{inv.placeOfSupply ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(inv.taxable)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inv.cgst ? formatINR(inv.cgst) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{inv.sgst ? formatINR(inv.sgst) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{inv.igst ? formatINR(inv.igst) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatINR(inv.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell colSpan={2}>Total · {gstr1.totals.count} invoice{gstr1.totals.count === 1 ? "" : "s"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(gstr1.totals.taxable)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(gstr1.totals.cgst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(gstr1.totals.sgst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(gstr1.totals.igst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(gstr1.totals.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TDS — payable / receivable */}
        <TabsContent value="tds">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">TDS position · FY {fy}</CardTitle></CardHeader>
            <CardContent className="px-0">
              {tds.payable === 0 && tds.receivable === 0 ? (
                <EmptyState icon={<Landmark className="size-5" />} title="No TDS activity" description="No TDS has been deducted or accrued in this financial year." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Particulars</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    <SummaryRow label="TDS payable (deducted from vendors, to remit)" hint="Cr · acct 2110" value={tds.payable} />
                    <SummaryRow label="TDS receivable (deducted by customers on us)" hint="Dr · acct 1210" value={tds.receivable} />
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
