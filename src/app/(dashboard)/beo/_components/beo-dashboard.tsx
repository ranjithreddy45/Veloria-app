"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ClipboardList, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBeo, type BeoListItem, type BookableEvent } from "@/actions/beo.actions";

export const STATUS_HUE: Record<string, Hue> = {
  DRAFT: "slate",
  PUBLISHED: "emerald",
  LOCKED: "violet",
};
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function BeoDashboard({
  beos,
  events,
  canWrite,
}: {
  beos: BeoListItem[];
  events: BookableEvent[];
  canWrite: boolean;
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("ALL");
  const [q, setQ] = React.useState("");

  const published = beos.filter((b) => b.status === "PUBLISHED").length;
  const locked = beos.filter((b) => b.status === "LOCKED").length;
  const openIncidents = beos.reduce((n, b) => n + (b.openIncidents ?? 0), 0);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return beos.filter((b) => {
      if (filter !== "ALL" && b.status !== filter) return false;
      if (!term) return true;
      return (
        b.beoNumber.toLowerCase().includes(term) ||
        (b.eventName ?? "").toLowerCase().includes(term) ||
        (b.venueName ?? "").toLowerCase().includes(term)
      );
    });
  }, [beos, filter, q]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: beos.length, DRAFT: 0, PUBLISHED: 0, LOCKED: 0 };
    for (const b of beos) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [beos]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Function sheets" value={beos.length} accent="indigo" icon={<ClipboardList className="size-4" />} />
        <StatTile label="Published" value={published} accent="emerald" icon={<CheckCircle2 className="size-4" />} sub={locked ? `${locked} locked` : undefined} />
        <StatTile label="Open incidents" value={openIncidents} accent="rose" icon={<AlertTriangle className="size-4" />} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "PUBLISHED", "LOCKED"] as const).map((s) => (
            <StatusChip
              key={s}
              label={s === "ALL" ? "All" : STATUS_LABEL[s]}
              count={counts[s] ?? 0}
              active={filter === s}
              onClick={() => setFilter(s)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search BEO #, event, venue…"
            className="h-9 w-full sm:w-72"
          />
          {canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
              <Plus className="size-3.5" /> New function sheet
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-[15px]">Function sheets</CardTitle></CardHeader>
        <CardContent className="p-0">
          {beos.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="No function sheets yet"
              description={
                canWrite
                  ? "A function sheet (BEO) is the day-of playbook for a confirmed event. Click “New function sheet” above and pick a confirmed booking to build your first one."
                  : "Function sheets appear here once they’re created for confirmed events."
              }
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">BEO #</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Covers</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">No function sheets match this filter.</td></tr>
                ) : (
                  filtered.map((b) => (
                    <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <Link href={`/beo/${b.id}`} className="font-medium text-foreground hover:underline">
                          {b.beoNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{b.eventName ?? "—"}</div>
                        <div className="text-[11.5px] text-muted-foreground">
                          {[b.eventType, b.venueName].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(b.date)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{b.covers ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill label={STATUS_LABEL[b.status] ?? b.status} hue={STATUS_HUE[b.status] ?? "slate"} size="xs" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {canWrite && <CreateBeoDialog events={events} open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}

function StatusChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-medium ${active ? "border-foreground/15 bg-muted text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted/50"}`}
    >
      {label}
      <span className="rounded-md bg-foreground/10 px-1 text-[11px] tabular-nums">{count}</span>
    </button>
  );
}

function CreateBeoDialog({ events, open, onOpenChange }: { events: BookableEvent[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [bookingId, setBookingId] = React.useState("");
  const [covers, setCovers] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) { setBookingId(""); setCovers(""); }
  }, [open]);

  const selected = events.find((e) => e.id === bookingId);

  function pick(id: string) {
    setBookingId(id);
    const e = events.find((x) => x.id === id);
    if (e?.guestCount != null) setCovers(String(e.guestCount));
  }

  async function create() {
    if (!bookingId) { toast.error("Pick an event first."); return; }
    setBusy(true);
    try {
      const res = await createBeo({ bookingId, covers: covers ? Number(covers) : undefined });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Function sheet created");
      onOpenChange(false);
      router.push(`/beo/${res.data.id}`);
    } catch {
      toast.error("Couldn't create — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New function sheet</DialogTitle>
          <DialogDescription>Create a BEO from a confirmed booking. Covers pre-fill from the guest count.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label>Event (confirmed booking)</Label>
            <Select value={bookingId || undefined} onValueChange={pick}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select an event…" /></SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <div className="px-2 py-1.5 text-[12.5px] text-muted-foreground">No confirmed events.</div>
                ) : (
                  events.map((e) => (
                    <SelectItem key={e.id} value={e.id} disabled={e.hasBeo}>
                      {e.label}{e.hasBeo ? " (has BEO)" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selected?.hasBeo && (
              <p className="text-[12px] text-amber-600">This event already has a function sheet.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Covers</Label>
            <Input inputMode="numeric" value={covers} onChange={(e) => setCovers(e.target.value)} placeholder="Number of covers" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={create} disabled={busy || !bookingId || selected?.hasBeo}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
