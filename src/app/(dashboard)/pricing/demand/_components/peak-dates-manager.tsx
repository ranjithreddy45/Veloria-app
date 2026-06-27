"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, Trash2Icon, PlusIcon, LayersIcon } from "lucide-react";

import {
  createPeakDate,
  updatePeakDate,
  deletePeakDate,
  bulkCreatePeakDates,
  type PeakDateRow,
} from "@/actions/peak-dates.actions";
import { PEAK_DATE_TYPES, type PeakDateType } from "@/schemas/peak-date.schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Venue {
  id: string;
  name: string;
}

interface Props {
  initialPeakDates: PeakDateRow[];
  venues: Venue[];
  canManage: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  MUHURTHAM: "Muhurtham",
  FESTIVAL: "Festival",
  CUSTOM: "Custom",
};
const TYPE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  MUHURTHAM: "default",
  FESTIVAL: "secondary",
  CUSTOM: "outline",
};

const ALL_VENUES = "__all__";

const todayKey = () => new Date().toISOString().slice(0, 10);

function fmtDate(key: string): string {
  // key is "YYYY-MM-DD" — format as UTC so it never drifts a day.
  const d = new Date(key + "T00:00:00.000Z");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface FormState {
  id: string | null;
  date: string;
  type: PeakDateType;
  label: string;
  premiumPct: string; // "" = use config default
  venueId: string; // ALL_VENUES or a venue id
  isActive: boolean;
  note: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  date: todayKey(),
  type: "MUHURTHAM",
  label: "",
  premiumPct: "",
  venueId: ALL_VENUES,
  isActive: true,
  note: "",
};

export function PeakDatesManager({ initialPeakDates, venues, canManage }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Split into upcoming (today onward) and past — show upcoming first.
  const today = todayKey();
  const upcoming = initialPeakDates.filter((p) => p.date >= today);
  const past = initialPeakDates.filter((p) => p.date < today);

  function openCreate() {
    setForm({ ...EMPTY_FORM, date: todayKey() });
    setEditOpen(true);
  }

  function openEdit(row: PeakDateRow) {
    setForm({
      id: row.id,
      date: row.date,
      type: (row.type as PeakDateType) ?? "CUSTOM",
      label: row.label,
      premiumPct: row.premiumPct == null ? "" : String(row.premiumPct),
      venueId: row.venueId ?? ALL_VENUES,
      isActive: row.isActive,
      note: row.note ?? "",
    });
    setEditOpen(true);
  }

  async function saveForm() {
    if (!form.date) return toast.error("Pick a date");
    if (!form.label.trim()) return toast.error("Add a label");
    setBusy(true);
    try {
      const payload = {
        date: form.date,
        type: form.type,
        label: form.label.trim(),
        premiumPct: form.premiumPct === "" ? null : Number(form.premiumPct),
        venueId: form.venueId === ALL_VENUES ? null : form.venueId,
        isActive: form.isActive,
        note: form.note.trim() || null,
      };
      const res = form.id
        ? await updatePeakDate(form.id, payload)
        : await createPeakDate(payload);
      if (res.success) {
        toast.success(form.id ? "Peak date updated" : "Peak date added");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to save peak date");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      const res = await deletePeakDate(id);
      if (res.success) {
        toast.success("Peak date removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to remove peak date");
    } finally {
      setDeletingId(null);
    }
  }

  function renderRows(rows: PeakDateRow[]) {
    return rows.map((row) => (
      <TableRow key={row.id} className={row.isActive ? "" : "opacity-50"}>
        <TableCell className="font-medium whitespace-nowrap">
          {fmtDate(row.date)}
        </TableCell>
        <TableCell>
          <Badge variant={TYPE_VARIANT[row.type] ?? "outline"}>
            {TYPE_LABEL[row.type] ?? row.type}
          </Badge>
        </TableCell>
        <TableCell>{row.label}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {row.premiumPct == null ? (
            <span className="italic">config default</span>
          ) : (
            <span className="font-medium text-foreground">+{row.premiumPct}%</span>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {row.venueName ?? "All venues"}
        </TableCell>
        <TableCell>
          {row.isActive ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Active
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Inactive</span>
          )}
        </TableCell>
        {canManage && (
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => openEdit(row)}
                aria-label="Edit"
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-red-600 hover:text-red-700"
                onClick={() => remove(row.id)}
                disabled={deletingId === row.id}
                aria-label="Delete"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    ));
  }

  const colCount = canManage ? 7 : 6;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Peak-date calendar</CardTitle>
          <CardDescription>
            Muhurtham, festival and custom premium dates. Weekends are premium
            automatically — list only the specific auspicious / festival dates here.
          </CardDescription>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <LayersIcon className="mr-2 size-4" />
              Bulk add
            </Button>
            <Button onClick={openCreate}>
              <PlusIcon className="mr-2 size-4" />
              Add date
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Upcoming ({upcoming.length})
          </h3>
          {upcoming.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No upcoming peak dates. Add Muhurtham / festival dates so Sales charges
              the premium.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>{renderRows(upcoming)}</TableBody>
              </Table>
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Past ({past.length})
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>{renderRows(past)}</TableBody>
              </Table>
            </div>
          </section>
        )}
        {/* colCount keeps header/body column counts in sync if a section is empty */}
        <span className="hidden">{colCount}</span>
      </CardContent>

      {/* Add / edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit peak date" : "Add peak date"}</DialogTitle>
            <DialogDescription>
              A premium % overrides the config default for this type. Leave it blank to
              use the configured default.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pd-date">Date</Label>
                <Input
                  id="pd-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as PeakDateType }))
                  }
                >
                  <SelectTrigger id="pd-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PEAK_DATE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-label">Label</Label>
              <Input
                id="pd-label"
                placeholder="e.g. Akshaya Tritiya, Diwali Muhurtham"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pd-premium">Premium % (optional)</Label>
                <Input
                  id="pd-premium"
                  type="number"
                  min={0}
                  placeholder="config default"
                  value={form.premiumPct}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, premiumPct: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-venue">Scope</Label>
                <Select
                  value={form.venueId}
                  onValueChange={(v) => setForm((f) => ({ ...f, venueId: v }))}
                >
                  <SelectTrigger id="pd-venue">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VENUES}>All venues</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-note">Note (optional)</Label>
              <Textarea
                id="pd-note"
                rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="size-4 rounded border-input"
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveForm} disabled={busy}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAddDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        venues={venues}
        onDone={() => {
          setBulkOpen(false);
          router.refresh();
        }}
      />
    </Card>
  );
}

// ------------------------------------------------------------
// Bulk paste dialog — paste a year's dates, one per line.
// ------------------------------------------------------------
function BulkAddDialog({
  open,
  onOpenChange,
  venues,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  venues: Venue[];
  onDone: () => void;
}) {
  const [type, setType] = React.useState<PeakDateType>("MUHURTHAM");
  const [venueId, setVenueId] = React.useState(ALL_VENUES);
  const [premiumPct, setPremiumPct] = React.useState("");
  const [raw, setRaw] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Parse "YYYY-MM-DD" or "YYYY-MM-DD, Label" per line.
  function parseRows(): { date: string; label?: string }[] {
    const out: { date: string; label?: string }[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = /^(\d{4}-\d{2}-\d{2})\s*(?:[,|\t-]\s*(.*))?$/.exec(trimmed);
      if (!m) continue;
      out.push({ date: m[1], label: m[2]?.trim() || undefined });
    }
    return out;
  }

  const parsed = parseRows();

  async function submit() {
    if (parsed.length === 0) {
      toast.error("Paste at least one valid YYYY-MM-DD date");
      return;
    }
    setBusy(true);
    try {
      const res = await bulkCreatePeakDates({
        type,
        premiumPct: premiumPct === "" ? null : Number(premiumPct),
        venueId: venueId === ALL_VENUES ? null : venueId,
        rows: parsed,
      });
      if (res.success) {
        toast.success(
          `Added ${res.data.created} date${res.data.created === 1 ? "" : "s"}${
            res.data.skipped ? ` · ${res.data.skipped} already existed` : ""
          }`
        );
        setRaw("");
        onDone();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to bulk-add dates");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk add peak dates</DialogTitle>
          <DialogDescription>
            Paste one date per line as <code>YYYY-MM-DD</code>, optionally followed by a
            comma and a label (e.g. <code>2026-05-10, Akshaya Tritiya</code>). All
            lines share the type, premium and scope below. Dates that already exist are
            skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PeakDateType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PEAK_DATE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Premium %</Label>
              <Input
                type="number"
                min={0}
                placeholder="default"
                value={premiumPct}
                onChange={(e) => setPremiumPct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VENUES}>All venues</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-raw">Dates</Label>
            <Textarea
              id="bulk-raw"
              rows={8}
              placeholder={"2026-05-10, Akshaya Tritiya\n2026-11-08, Diwali Muhurtham\n2026-12-06"}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {parsed.length} valid date{parsed.length === 1 ? "" : "s"} detected.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || parsed.length === 0}>
            {busy ? "Adding…" : `Add ${parsed.length || ""} dates`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
