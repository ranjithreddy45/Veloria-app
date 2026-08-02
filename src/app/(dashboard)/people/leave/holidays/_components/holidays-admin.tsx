"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { upsertHoliday, deleteHoliday } from "@/actions/hr-leave.actions";

export interface Holiday {
  id: string;
  name: string;
  date: string; // yyyy-mm-dd
  year: number;
}

// Format a yyyy-mm-dd key without timezone drift (parse as UTC, render in UTC).
function fmtDate(key: string): string {
  const d = new Date(key + "T00:00:00.000Z");
  return d.toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function HolidaysAdmin({ holidays, year }: { holidays: Holiday[]; year: number }) {
  const router = useRouter();
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 9 }, (_, i) => thisYear - 3 + i);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-copy font-semibold">Public holidays</h3>
          <p className="text-detail text-muted-foreground">
            {holidays.length} holiday{holidays.length === 1 ? "" : "s"} in {year}. Add movable festivals and future years here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => router.push(`/people/leave/holidays?year=${e.target.value}`)}
            className="h-9 rounded-md border bg-background px-2.5 text-body outline-none focus:ring-2 focus:ring-ring"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <HolidayDialog defaultYear={year} />
        </div>
      </div>

      {holidays.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No holidays for {year} yet. Add them so leave counts skip these days.
        </div>
      ) : (
        <div className="divide-y">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{h.name}</div>
                <span className="text-detail text-muted-foreground">{fmtDate(h.date)}</span>
              </div>
              <HolidayDialog existing={h} defaultYear={year} />
              <DeleteHolidayButton id={h.id} name={h.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HolidayDialog({ existing, defaultYear }: { existing?: Holiday; defaultYear: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(existing?.name ?? "");
  const [date, setDate] = React.useState(existing?.date ?? `${defaultYear}-01-01`);

  // Reset fields when the dialog is (re)opened.
  React.useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setDate(existing?.date ?? `${defaultYear}-01-01`);
      setError(null);
    }
  }, [open, existing, defaultYear]);

  async function save() {
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!date) { setError("Date is required."); return; }
    setSaving(true);
    const res = await upsertHoliday({ id: existing?.id, date, name });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing
          ? <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button>
          : <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add holiday</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{existing ? "Edit holiday" : "New holiday"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-detail">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deepavali" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteHolidayButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setError(null);
    setBusy(true);
    const res = await deleteHoliday(id);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Delete holiday?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Remove <span className="font-medium text-foreground">{name}</span> from the holiday calendar? Leave already applied is not recalculated.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={confirm} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
