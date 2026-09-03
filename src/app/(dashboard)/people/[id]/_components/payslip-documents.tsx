"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Trash2, Upload, FileText, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  upsertPayslipDocument, removePayslipDocument, getPayslipDocument,
} from "@/actions/hr-payslip-doc.actions";

// ============================================================
// Payslip documents, month by month.
//
// Sits alongside the GENERATED payslips (from payroll runs) rather than mixing
// with them — see hr-payslip-doc.actions for why two sources of truth for "the
// payslip" would be dangerous. The heading says which is which so nobody has
// to guess.
// ============================================================

export interface PayslipDocRow {
  id: string;
  year: number;
  month: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string | null;
  updatedAt: Date | string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Payslips are historical; offering 2000–2100 in a dropdown helps nobody. */
function recentYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2, y - 3];
}

function human(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

export function PayslipDocuments({
  employeeId,
  docs,
  canManage,
}: {
  employeeId: string;
  docs: PayslipDocRow[];
  canManage: boolean;
}) {
  const now = new Date();
  const [year, setYear] = React.useState(String(now.getFullYear()));
  // Default to LAST month: payslips are uploaded after a month closes, so the
  // current month is almost never the one being filed.
  const [month, setMonth] = React.useState(String(now.getMonth() === 0 ? 12 : now.getMonth()));
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const existing = docs.find((d) => d.year === Number(year) && d.month === Number(month));

  function pick() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;

    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read that file."));
        r.readAsDataURL(file);
      });

      const res = await upsertPayslipDocument({
        employeeId,
        year: Number(year),
        month: Number(month),
        fileName: file.name,
        mimeType: file.type,
        data,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.replaced
          ? `${MONTHS[Number(month) - 1]} ${year} payslip replaced`
          : `${MONTHS[Number(month) - 1]} ${year} payslip uploaded`
      );
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function view(id: string) {
    const res = await getPayslipDocument(id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    // Open from the data-URL rather than a fetch: the bytes are already here,
    // and there is no public URL to link to.
    const w = window.open();
    if (!w) {
      toast.error("Allow pop-ups to view the payslip.");
      return;
    }
    w.document.write(
      res.data.mimeType === "application/pdf"
        ? `<iframe src="${res.data.data}" style="border:0;width:100%;height:100vh"></iframe>`
        : `<img src="${res.data.data}" style="max-width:100%" alt="${res.data.fileName}" />`
    );
    w.document.title = res.data.fileName;
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Delete the ${label} payslip? This cannot be undone.`)) return;
    const res = await removePayslipDocument(id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Payslip removed");
    window.location.reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Uploaded payslips</CardTitle>
        <p className="mt-1 text-detail text-muted-foreground">
          Payslip files kept month by month. Separate from the payslips generated
          by a payroll run, which appear above.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {recentYears().map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFile}
            />
            <Button onClick={pick} disabled={busy}>
              {existing ? <RefreshCw className="mr-2 size-4" /> : <Upload className="mr-2 size-4" />}
              {busy ? "Uploading…" : existing ? "Replace payslip" : "Upload payslip"}
            </Button>

            {/* Say what will happen BEFORE the click, not after — replacing is
                destructive and the button label alone is easy to miss. */}
            {existing && (
              <p className="text-detail text-warning">
                {MONTHS[Number(month) - 1]} {year} already has a payslip. Uploading replaces it.
              </p>
            )}
          </div>
        )}

        {docs.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
            No payslips uploaded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {MONTHS[d.month - 1]} {d.year}
                    </p>
                    <p className="truncate text-detail text-muted-foreground">
                      {d.fileName} · {human(d.sizeBytes)}
                      {d.uploadedByName ? ` · ${d.uploadedByName}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => view(d.id)}>
                    <Download className="mr-1.5 size-3.5" />
                    View
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => remove(d.id, `${MONTHS[d.month - 1]} ${d.year}`)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
