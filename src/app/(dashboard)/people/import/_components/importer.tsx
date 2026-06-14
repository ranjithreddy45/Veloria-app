"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertTriangle, XCircle, Loader2, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  previewImport, commitImport,
  type ImportRowInput, type ImportPreview,
} from "@/actions/hr-import.actions";
import { IMPORT_COLUMNS } from "@/lib/hr/import-columns";

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines).
function parseCsv(text: string): ImportRowInput[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: ImportRowInput = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
    return obj;
  });
}

const SAMPLE = [
  IMPORT_COLUMNS.join(","),
  "Varshitha,Reddy,varshitha@propertyplush.in,,+919800000001,DIGIMARK,Veloria / Billion Events,Human Resources,HR Manager,FULL_TIME,2025-04-01,Bengaluru HQ,,ACTIVE",
  "Arjun,Mehta,arjun@propertyplush.in,,+919800000002,OLIVE,Olive Hotels,Operations,Manager,FULL_TIME,2025-06-15,Olive Indiranagar,,ACTIVE",
].join("\n");

export function Importer() {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<ImportRowInput[]>([]);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const t = String(reader.result); setText(t); };
    reader.readAsText(file);
  }

  async function runPreview() {
    const parsed = parseCsv(text);
    setRows(parsed);
    setDone(null);
    if (parsed.length === 0) { setPreview({ rows: [], validCount: 0, invalidCount: 0 }); return; }
    setBusy(true);
    const p = await previewImport(parsed);
    setBusy(false);
    setPreview(p);
  }

  async function runCommit() {
    setBusy(true);
    const res = await commitImport(rows);
    setBusy(false);
    if (res.success) {
      setDone(`Imported ${res.created} employee${res.created === 1 ? "" : "s"}${res.skipped ? `, skipped ${res.skipped}` : ""}.`);
      setPreview(null); setText(""); setRows([]);
      router.refresh();
    } else {
      setDone(res.error ?? "Import failed.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            <FileSpreadsheet className="size-4" /> Paste or upload CSV
          </h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>Load sample</Button>
            <label>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <span><Upload className="size-3.5" /> Upload file</span>
              </Button>
            </label>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Columns: ${IMPORT_COLUMNS.join(", ")}`}
          className="h-44 w-full resize-y rounded-lg border bg-background p-3 font-mono text-[12px] outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-2 text-[12px] text-muted-foreground">
          Required: <code>firstName</code>, <code>lastName</code>, <code>legalEntity</code> (name or short code).
          Optional columns are matched leniently. Manager is referenced by their employee code.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={runPreview} disabled={busy || !text.trim()} className="gap-1.5">
            {busy && !preview ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Validate
          </Button>
          {done && <span className="text-[13px] text-emerald-600">{done}</span>}
        </div>
      </div>

      {preview && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
              <CheckCircle2 className="size-4" /> {preview.validCount} ready
            </span>
            {preview.invalidCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-red-600">
                <XCircle className="size-4" /> {preview.invalidCount} with errors
              </span>
            )}
            <Button
              className="ml-auto gap-1.5"
              onClick={runCommit}
              disabled={busy || preview.validCount === 0}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Import {preview.validCount} valid row{preview.validCount === 1 ? "" : "s"}
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-lg border">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.index} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.index + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-3.5" /> Ready</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="size-3.5" /> Error</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {r.errors.map((e, i) => (
                        <div key={`e${i}`} className="text-red-600">{e}</div>
                      ))}
                      {r.warnings.map((w, i) => (
                        <div key={`w${i}`} className="inline-flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="size-3" /> {w}
                        </div>
                      ))}
                      {r.ok && r.errors.length === 0 && r.warnings.length === 0 && <span>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
