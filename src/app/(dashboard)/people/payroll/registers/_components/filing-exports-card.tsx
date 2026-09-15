"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buildPfEcr, buildEsiReturn, buildTds24q } from "@/actions/hr-statutory-exports.actions";
import type { ExportFile } from "@/lib/hr/statutory-exports";

// ============================================================
// "Exports for filing" — PF ECR (.txt), ESI monthly contribution (.csv) and the
// TDS 24Q annexure helper (.csv). The server action builds the file; the
// browser turns it into a Blob download. Warnings (missing UAN / IP / PAN,
// rounded days, assumed dates) are listed after every generation so nothing
// is silently dropped on the way to a portal.
// ============================================================

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FINAL = new Set(["LOCKED", "PAID"]);
const QUARTERS = [
  { q: 1, label: "Q1 · Apr–Jun" },
  { q: 2, label: "Q2 · Jul–Sep" },
  { q: 3, label: "Q3 · Oct–Dec" },
  { q: 4, label: "Q4 · Jan–Mar" },
];

interface Period { fy: string; month: number; label: string; status: string; headcount: number }
type Kind = "pf" | "esi" | "tds";
interface Generated { kind: Kind; title: string; file: ExportFile }

function quarterOf(month: number): number {
  return month >= 4 ? Math.ceil((month - 3) / 3) : 4;
}

function downloadText(file: ExportFile) {
  // No BOM: the EPFO parser reads the first bytes as the first UAN.
  const blob = new Blob([file.content], { type: `${file.mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function FilingExportsCard({ periods }: { periods: Period[] }) {
  // Only finalised runs can be filed — drafts still move.
  const finalPeriods = React.useMemo(() => periods.filter((p) => FINAL.has(p.status)), [periods]);
  const fys = React.useMemo(() => Array.from(new Set(finalPeriods.map((p) => p.fy))), [finalPeriods]);
  const latest = finalPeriods[0];
  const keyOf = (p: Period) => `${p.fy}|${p.month}`;

  const [pfKey, setPfKey] = React.useState(latest ? keyOf(latest) : "");
  const [esiKey, setEsiKey] = React.useState(latest ? keyOf(latest) : "");
  const [tdsFy, setTdsFy] = React.useState(latest?.fy ?? "");
  const [tdsQuarter, setTdsQuarter] = React.useState(latest ? String(quarterOf(latest.month)) : "1");
  const [busy, setBusy] = React.useState<Kind | null>(null);
  const [generated, setGenerated] = React.useState<Generated | null>(null);

  async function run(kind: Kind, title: string, build: () => Promise<Awaited<ReturnType<typeof buildPfEcr>>>) {
    setBusy(kind);
    try {
      const res = await build();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      downloadText(res.data);
      setGenerated({ kind, title, file: res.data });
      toast.success(`${res.data.fileName} downloaded (${res.data.rowCount} rows)`);
    } catch {
      toast.error("Could not generate the export.");
    } finally {
      setBusy(null);
    }
  }

  const split = (k: string) => {
    const [fy, m] = k.split("|");
    return { fy, month: Number(m) };
  };

  const periodSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
      <SelectContent>
        {finalPeriods.map((p) => (
          <SelectItem key={keyOf(p)} value={keyOf(p)}>
            {MONTHS[p.month]} · FY {p.fy} ({p.headcount})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="size-4" /> Exports for filing
        </CardTitle>
        <CardDescription>
          Upload-ready files built from locked payroll runs. Every employee missing a UAN, IP number or PAN is
          listed below the download — nothing is dropped silently.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {finalPeriods.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Lock a payroll run to enable filing exports. Draft runs cannot be filed.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {/* PF ECR */}
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">PF ECR (EPFO)</p>
                <p className="text-detail text-muted-foreground">
                  ECR v2 text file for the Unified Portal — <code>#~#</code>-separated, one line per member.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Wage month</Label>
                {periodSelect(pfKey, setPfKey)}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!pfKey || busy !== null}
                onClick={() => run("pf", "PF ECR", () => buildPfEcr(split(pfKey)))}
              >
                {busy === "pf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Download ECR (.txt)
              </Button>
            </div>

            {/* ESI */}
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">ESI monthly contribution (ESIC)</p>
                <p className="text-detail text-muted-foreground">
                  The six columns of the ESIC MC template. Open in Excel and save as .xls before uploading.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Contribution month</Label>
                {periodSelect(esiKey, setEsiKey)}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!esiKey || busy !== null}
                onClick={() => run("esi", "ESI monthly contribution", () => buildEsiReturn(split(esiKey)))}
              >
                {busy === "esi" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Download ESI (.csv)
              </Button>
            </div>

            {/* TDS 24Q */}
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">TDS Form 24Q helper</p>
                <p className="text-detail text-muted-foreground">
                  Section 192 deductee rows plus a monthly summary for the quarter. The FVU/RPU file must still be
                  prepared in the NSDL (Protean) RPU utility from this data — this is not the return itself.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>FY</Label>
                  <Select value={tdsFy} onValueChange={setTdsFy}>
                    <SelectTrigger><SelectValue placeholder="FY" /></SelectTrigger>
                    <SelectContent>
                      {fys.map((fy) => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quarter</Label>
                  <Select value={tdsQuarter} onValueChange={setTdsQuarter}>
                    <SelectTrigger><SelectValue placeholder="Quarter" /></SelectTrigger>
                    <SelectContent>
                      {QUARTERS.map((q) => <SelectItem key={q.q} value={String(q.q)}>{q.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!tdsFy || busy !== null}
                onClick={() => run("tds", "TDS 24Q helper", () => buildTds24q({ fy: tdsFy, quarter: Number(tdsQuarter) }))}
              >
                {busy === "tds" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Download 24Q helper (.csv)
              </Button>
            </div>
          </div>
        )}

        {generated && (
          generated.file.warnings.length > 0 ? (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>
                {generated.title}: {generated.file.fileName} — {generated.file.rowCount} rows,{" "}
                {generated.file.warnings.length} warning{generated.file.warnings.length === 1 ? "" : "s"}
              </AlertTitle>
              <AlertDescription>
                <p className="mb-1">Fix the flagged records and regenerate before uploading.</p>
                <ul className="list-disc space-y-1 pl-4">
                  {generated.file.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertTitle>
                {generated.title}: {generated.file.fileName} — {generated.file.rowCount} rows
              </AlertTitle>
              <AlertDescription>No warnings. Every employee in the file has the statutory ID the portal needs.</AlertDescription>
            </Alert>
          )
        )}
      </CardContent>
    </Card>
  );
}
