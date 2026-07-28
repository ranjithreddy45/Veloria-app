"use client";

// ============================================================
// Finance reports (W5) — P&L, Balance Sheet, Trial Balance tabs with an FY
// selector. Pure presentation; data is derived server-side from posted lines.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Scale, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR } from "@/lib/utils";

interface Line { code: string; name: string; amount: number }
interface PL { income: Line[]; expense: Line[]; totalIncome: number; totalExpense: number; netProfit: number }
interface BS { assets: Line[]; liabilities: Line[]; equity: Line[]; totalAssets: number; totalLiabilities: number; totalEquity: number; retainedEarnings: number; balanced: boolean }
interface TB { rows: { code: string; name: string; debit: number; credit: number }[]; totalDebit: number; totalCredit: number; balanced: boolean }

function LineTable({ rows, total, totalLabel }: { rows: Line[]; total: number; totalLabel: string }) {
  return (
    <Table>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={2} className="py-4 text-center text-sm text-muted-foreground">No postings.</TableCell></TableRow>
        ) : rows.map((l) => (
          <TableRow key={l.code}>
            <TableCell className="text-[13px]"><span className="numeric text-muted-foreground">{l.code}</span> {l.name}</TableCell>
            <TableCell className="numeric text-right text-[13px]">{formatINR(l.amount)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="border-t-2 bg-muted/20 font-semibold hover:bg-muted/20">
          <TableCell className="text-[13px]">{totalLabel}</TableCell>
          <TableCell className="numeric text-right text-[13px]">{formatINR(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function FinanceReports({
  fy, fiscalYears, pl, bs, tb,
}: {
  fy: string;
  fiscalYears: string[];
  pl: PL;
  bs: BS;
  tb: TB;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Financial year</span>
        <Select value={fy} onValueChange={(v) => router.push(`/finance/reports?fy=${v}`)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{fiscalYears.map((y) => <SelectItem key={y} value={y}>FY {y}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">Balance Sheet is cumulative to date.</span>
      </div>

      <Tabs defaultValue="pl">
        <TabsList>
          <TabsTrigger value="pl"><TrendingUp className="size-4" /> P&amp;L</TabsTrigger>
          <TabsTrigger value="bs"><Scale className="size-4" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="tb"><BookOpen className="size-4" /> Trial Balance</TabsTrigger>
        </TabsList>

        {/* Profit & Loss */}
        <TabsContent value="pl" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-card"><CardHeader className="pb-2"><CardTitle className="text-sm">Income</CardTitle><p className="text-[11px] text-muted-foreground">Recognized (accrual)</p></CardHeader><CardContent className="px-0"><LineTable rows={pl.income} total={pl.totalIncome} totalLabel="Total income" /></CardContent></Card>
            <Card className="border-0 shadow-card"><CardHeader className="pb-2"><CardTitle className="text-sm">Expenses</CardTitle></CardHeader><CardContent className="px-0"><LineTable rows={pl.expense} total={pl.totalExpense} totalLabel="Total expenses" /></CardContent></Card>
          </div>
          <Card className="border-0 shadow-card">
            <CardContent className="flex items-center justify-between py-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Net {pl.netProfit >= 0 ? "profit" : "loss"} · <span className="numeric tracking-normal">FY {fy}</span></span>
              <span className={`numeric text-[26px] font-bold ${pl.netProfit >= 0 ? "text-success" : "text-destructive"}`}>{formatINR(pl.netProfit)}</span>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="bs" className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusPill label={bs.balanced ? "Balanced" : "Out of balance"} hue={bs.balanced ? "emerald" : "rose"} size="sm" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-card"><CardHeader className="pb-2"><CardTitle className="text-sm">Assets</CardTitle></CardHeader><CardContent className="px-0"><LineTable rows={bs.assets} total={bs.totalAssets} totalLabel="Total assets" /></CardContent></Card>
            <div className="space-y-4">
              <Card className="border-0 shadow-card"><CardHeader className="pb-2"><CardTitle className="text-sm">Liabilities</CardTitle></CardHeader><CardContent className="px-0"><LineTable rows={bs.liabilities} total={bs.totalLiabilities} totalLabel="Total liabilities" /></CardContent></Card>
              <Card className="border-0 shadow-card"><CardHeader className="pb-2"><CardTitle className="text-sm">Equity</CardTitle></CardHeader><CardContent className="px-0"><LineTable rows={bs.equity} total={bs.totalEquity} totalLabel="Total equity" /></CardContent></Card>
            </div>
          </div>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="tb">
          <Card className="border-0 shadow-card">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 [&>th]:h-9 [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-[0.05em] [&>th]:text-muted-foreground"><TableHead>Account</TableHead><TableHead className="w-40 text-right">Debit</TableHead><TableHead className="w-40 text-right">Credit</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {tb.rows.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="py-4 text-center text-sm text-muted-foreground">No postings yet.</TableCell></TableRow>
                  ) : tb.rows.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="text-[13px]"><span className="numeric text-muted-foreground">{r.code}</span> {r.name}</TableCell>
                      <TableCell className="numeric text-right text-[13px]">{r.debit ? formatINR(r.debit) : "—"}</TableCell>
                      <TableCell className="numeric text-right text-[13px]">{r.credit ? formatINR(r.credit) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/20 font-semibold hover:bg-muted/20">
                    <TableCell className="text-[13px]">Total {tb.balanced ? "(balanced)" : "(out of balance)"}</TableCell>
                    <TableCell className="numeric text-right text-[13px]">{formatINR(tb.totalDebit)}</TableCell>
                    <TableCell className="numeric text-right text-[13px]">{formatINR(tb.totalCredit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
