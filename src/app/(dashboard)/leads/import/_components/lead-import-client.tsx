"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

import { rowsFromCsv, mapLeadStatus, type RawLeadRow } from "@/lib/sales/lead-import";
import { importSalesLeads, type ImportSummary } from "@/actions/lead-import.actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LeadImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<RawLeadRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [parseError, setParseError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setParseError("");
    setRows([]);
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = rowsFromCsv(text);
      if (parsed.length === 0) {
        setParseError("No data rows found. Make sure the first row is the column headers.");
        return;
      }
      setRows(parsed);
    } catch {
      setParseError("Could not read the file. Please upload a .csv export of the sheet.");
    }
  }

  async function runImport() {
    if (rows.length === 0) return;
    if (replaceExisting && confirmText.trim().toUpperCase() !== "REPLACE") {
      toast.error('Type REPLACE to confirm wiping the existing leads.');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await importSalesLeads(rows, { replaceExisting });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      toast.success(`Imported ${res.data.imported} leads.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Upload the sales-leads file (.csv)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="border-muted-foreground/30 hover:bg-muted/40 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center transition-colors">
            <UploadCloud className="text-muted-foreground size-7" />
            <span className="text-sm font-medium">
              {fileName || "Click to choose your CSV file"}
            </span>
            <span className="text-muted-foreground text-xs">
              Export the Excel sheet as CSV (File → Save As → CSV), then upload it here.
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          {parseError && (
            <p className="text-destructive flex items-center gap-1.5 text-sm">
              <AlertTriangle className="size-4" /> {parseError}
            </p>
          )}
          {rows.length > 0 && (
            <p className="text-success text-sm">
              ✓ Parsed <span className="font-semibold">{rows.length}</span> leads from{" "}
              <span className="font-medium">{fileName}</span>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Preview (first {Math.min(rows.length, 10)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Phone</th>
                    <th className="py-2 pr-3 font-medium">Event</th>
                    <th className="py-2 pr-3 font-medium">Guests</th>
                    <th className="py-2 pr-3 font-medium">Quote</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.leadName || "—"}</td>
                      <td className="py-2 pr-3">{r.phone || "—"}</td>
                      <td className="py-2 pr-3">{r.eventDetails || "—"}</td>
                      <td className="py-2 pr-3">{r.attendees || "—"}</td>
                      <td className="py-2 pr-3">{r.quoteValue || "—"}</td>
                      <td className="py-2">
                        <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                          {mapLeadStatus(r.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={replaceExisting}
                onCheckedChange={(v) => setReplaceExisting(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">Replace existing leads</span>
                <span className="text-muted-foreground block text-xs">
                  Soft-deletes all current leads first (recoverable from Settings → Trash), then
                  imports these. Leave unchecked to add these alongside existing leads.
                </span>
              </span>
            </label>

            {replaceExisting && (
              <div className="border-warning/30 bg-warning/10 rounded-xl border p-4">
                <p className="text-warning mb-2 text-xs">
                  This will remove all current leads. Type <strong>REPLACE</strong> to confirm.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="REPLACE"
                  className="border-input bg-background h-9 w-40 rounded-md border px-2 text-sm"
                />
              </div>
            )}

            <Button onClick={runImport} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {replaceExisting ? `Replace & import ${rows.length} leads` : `Import ${rows.length} leads`}
            </Button>

            {result && (
              <div className="bg-success/10 rounded-xl border p-4 text-body">
                <p className="text-success flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4" /> Import complete
                </p>
                <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
                  <li>Leads imported: {result.imported}</li>
                  <li>New contacts: {result.contactsCreated} · reused: {result.contactsReused}</li>
                  {result.replaced > 0 && <li>Existing leads replaced: {result.replaced}</li>}
                  {result.skipped.length > 0 && (
                    <li className="text-warning">
                      Skipped {result.skipped.length}:{" "}
                      {result.skipped.map((s) => `row ${s.row} (${s.reason})`).join(", ")}
                    </li>
                  )}
                </ul>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/leads")}>
                  View leads
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
