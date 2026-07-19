"use client";

import * as React from "react";
import {
  Ticket, CalendarDays, Trophy, Search, Loader2, Sparkles, Copy, Check,
  Download, RotateCcw, BellOff, ChevronLeft, ChevronRight, Gift,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---- types (mirror the /api/draw responses) --------------------------------
interface EntryRow {
  id: number;
  entry_code: string;
  guest_name: string;
  phone: string;
  host_name: string;
  event_type: string;
  event_type_label: string;
  event_date: string;
  consent_ts: string;
  opted_out: boolean;
  source: string;
  created_at: string;
}
interface EntriesResponse {
  data: EntryRow[];
  total: number;
  month_count: number;
  page: number;
  per_page: number;
}
interface WinnerEntry {
  entry_code: string;
  guest_name: string;
  phone_masked: string;
  host_name: string;
  event_type_label: string;
  event_date: string;
}
interface Winner {
  draw_month: string;
  pool_size: number;
  drawn_at: string;
  prize_delivered: boolean;
  announced: boolean;
  entry: WinnerEntry | null;
}

const PER_PAGE = 50;

// ---- month helpers ---------------------------------------------------------
/** Current + previous 11 months as "YYYY-MM" keys, newest first. */
function recentMonths(current: string): string[] {
  const [y, m] = current.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
/** "2026-08" → "August 2026". */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}
function fmtDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00Z" : iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const SOURCE_LABEL: Record<string, string> = { qr: "QR", tablet: "Tablet", manual: "Manual" };

export function DrawRegister({ isAdmin, currentMonth }: { isAdmin: boolean; currentMonth: string }) {
  const months = React.useMemo(() => recentMonths(currentMonth), [currentMonth]);

  const [month, setMonth] = React.useState(currentMonth);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [resp, setResp] = React.useState<EntriesResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [allTotal, setAllTotal] = React.useState<number | null>(null);
  const [monthTotal, setMonthTotal] = React.useState<number | null>(null);

  const [winner, setWinner] = React.useState<Winner | null>(null);
  const [winnerLoading, setWinnerLoading] = React.useState(true);

  const [drawing, setDrawing] = React.useState(false);
  const [confirmDraw, setConfirmDraw] = React.useState(false);
  const [confirmRedraw, setConfirmRedraw] = React.useState(false);
  const [optOutTarget, setOptOutTarget] = React.useState<EntryRow | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [savingPrize, setSavingPrize] = React.useState(false);
  const [savingAnnounced, setSavingAnnounced] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  // Debounce the search box.
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 whenever the month changes.
  React.useEffect(() => { setPage(1); }, [month]);

  const loadEntries = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, page: String(page), per_page: String(PER_PAGE) });
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/draw/entries?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as EntriesResponse;
      setResp(data);
    } catch {
      toast.error("Could not load the entry register.");
      setResp((prev) => prev ?? { data: [], total: 0, month_count: 0, page: 1, per_page: PER_PAGE });
    } finally {
      setLoading(false);
    }
  }, [month, page, debouncedQ]);

  // All-time total (stat tile) — one lightweight count, refreshed after opt-out.
  const loadAllTotal = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/draw/entries?per_page=1&page=1`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as EntriesResponse;
      setAllTotal(data.total);
    } catch { /* stat is best-effort */ }
  }, []);

  // Unfiltered count for the selected month — the pool-size hint for the draw.
  const loadMonthTotal = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/draw/entries?month=${month}&per_page=1&page=1`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as EntriesResponse;
      setMonthTotal(data.total);
    } catch { setMonthTotal(null); }
  }, [month]);

  const loadWinner = React.useCallback(async () => {
    setWinnerLoading(true);
    try {
      const res = await fetch(`/api/draw/winner?draw_month=${month}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { winner: Winner | null };
      setWinner(data.winner);
    } catch {
      toast.error("Could not load the winner for this month.");
      setWinner(null);
    } finally {
      setWinnerLoading(false);
    }
  }, [month]);

  React.useEffect(() => { void loadEntries(); }, [loadEntries]);
  React.useEffect(() => { void loadWinner(); void loadMonthTotal(); }, [loadWinner, loadMonthTotal]);
  React.useEffect(() => { void loadAllTotal(); }, [loadAllTotal]);

  // ---- draw ----------------------------------------------------------------
  async function runDraw() {
    setConfirmDraw(false);
    setDrawing(true);
    try {
      const res = await fetch(`/api/draw/winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draw_month: month }),
      });
      const data = (await res.json().catch(() => ({}))) as { winner?: Winner; error?: string };
      if (res.status === 201 && data.winner) {
        setWinner(data.winner);
        toast.success(`Winner drawn for ${monthLabel(month)}!`);
      } else if (res.status === 409 && data.winner) {
        setWinner(data.winner);
        toast.info("A winner was already drawn for this month.");
      } else if (res.status === 422) {
        toast.error("No eligible entries this month.");
      } else {
        toast.error(data.error || "Could not run the draw.");
      }
    } catch {
      toast.error("Could not run the draw. Please try again.");
    } finally {
      setDrawing(false);
    }
  }

  async function togglePrize(next: boolean) {
    setSavingPrize(true);
    try {
      const res = await fetch(`/api/draw/winner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draw_month: month, prize_delivered: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { winner?: Winner; error?: string };
      if (res.ok && data.winner) {
        setWinner(data.winner);
        toast.success(next ? "Marked prize as delivered." : "Marked prize as not delivered.");
      } else {
        toast.error(data.error || "Could not update the winner.");
      }
    } catch {
      toast.error("Could not update the winner.");
    } finally {
      setSavingPrize(false);
    }
  }

  async function toggleAnnounced(next: boolean) {
    setSavingAnnounced(true);
    try {
      const res = await fetch(`/api/draw/winner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draw_month: month, announced: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { winner?: Winner; error?: string };
      if (res.ok && data.winner) {
        setWinner(data.winner);
        toast.success(next ? "Marked as announced." : "Marked as not announced.");
      } else {
        toast.error(data.error || "Could not update the winner.");
      }
    } catch {
      toast.error("Could not update the winner.");
    } finally {
      setSavingAnnounced(false);
    }
  }

  async function reDraw() {
    setConfirmRedraw(false);
    try {
      const res = await fetch(`/api/draw/winner?draw_month=${month}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setWinner(null);
        toast.success("Winner cleared — you can draw again.");
      } else {
        toast.error(data.error || "Could not re-draw.");
      }
    } catch {
      toast.error("Could not re-draw. Please try again.");
    }
  }

  async function confirmOptOut() {
    const target = optOutTarget;
    setOptOutTarget(null);
    if (!target) return;
    try {
      const res = await fetch(`/api/draw/opt-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: target.phone }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; updated?: number; error?: string };
      if (res.ok && data.ok) {
        toast.success(`Opted out — ${data.updated ?? 0} ${(data.updated ?? 0) === 1 ? "entry" : "entries"} updated.`);
        void loadEntries();
        void loadAllTotal();
      } else {
        toast.error(data.error || "Could not opt this guest out.");
      }
    } catch {
      toast.error("Could not opt this guest out.");
    }
  }

  function exportCsv() {
    setExporting(true);
    try {
      // The endpoint returns a Content-Disposition attachment — let the browser handle it.
      window.location.href = `/api/draw/export?month=${month}`;
      toast.success(`Exporting entries for ${monthLabel(month)}…`);
    } finally {
      // Brief guard so the button doesn't look stuck; the download is a navigation.
      setTimeout(() => setExporting(false), 1500);
    }
  }

  async function copyAnnouncement() {
    if (!winner?.entry) return;
    const text = `Congratulations ${winner.entry.guest_name}! Winner of the Veloria Grand Guest Draw for ${monthLabel(month)}.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Announcement copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy the text manually.");
    }
  }

  const rows = resp?.data ?? [];
  const total = resp?.total ?? 0;
  const monthCount = resp?.month_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const winnerStatus = winnerLoading
    ? "…"
    : !winner
      ? "Not drawn"
      : winner.prize_delivered
        ? "Prize delivered"
        : "Drawn";
  const winnerAccent = !winner ? "amber" : winner.prize_delivered ? "emerald" : "violet";

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total entries"
          value={allTotal ?? 0}
          accent="blue"
          icon={<Ticket />}
          sub="All-time draw entries"
        />
        <StatTile
          label="This month"
          value={monthCount}
          accent="cyan"
          icon={<CalendarDays />}
          sub={`Entries in ${monthLabel(currentMonth)}`}
        />
        <StatTile
          label={`${monthLabel(month)} winner`}
          value={winnerStatus}
          accent={winnerAccent}
          icon={<Trophy />}
          sub={winner?.entry ? winner.entry.guest_name : "Draw not run yet"}
        />
      </div>

      {/* Winner card */}
      {winner?.entry && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-premium">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300">
                <Sparkles className="size-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Winner · {monthLabel(month)}
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight">{winner.entry.guest_name}</p>
              <p className="font-mono text-sm text-muted-foreground">
                {winner.entry.entry_code} · {winner.entry.phone_masked}
              </p>
              <p className="text-sm text-muted-foreground">
                Host: <span className="text-foreground">{winner.entry.host_name}</span> ·{" "}
                {winner.entry.event_type_label} · {fmtDate(winner.entry.event_date)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Drawn from a pool of {winner.pool_size} · {fmtDateTime(winner.drawn_at)}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              <Button variant="outline" size="sm" onClick={copyAnnouncement}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy announcement"}
              </Button>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Gift className="size-3.5" /> Prize delivered
                </span>
                <Switch
                  checked={winner.prize_delivered}
                  disabled={savingPrize}
                  onCheckedChange={togglePrize}
                  aria-label="Mark prize delivered"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="size-3.5" /> Announced
                </span>
                <Switch
                  checked={winner.announced}
                  disabled={savingAnnounced}
                  onCheckedChange={toggleAnnounced}
                  aria-label="Mark announced"
                />
              </div>
              {isAdmin && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmRedraw(true)}>
                  <RotateCcw className="size-4" /> Re-draw
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-52">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((mk) => (
                <SelectItem key={mk} value={mk}>{monthLabel(mk)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone or host…"
            className="pl-9"
          />
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex items-center gap-2">
          {!winner && (
            <Button onClick={() => setConfirmDraw(true)} disabled={drawing}>
              {drawing ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
              Draw winner
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Entry table */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Host / Event</TableHead>
              <TableHead>Event date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Entered</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-sm text-muted-foreground">
                  {debouncedQ ? "No entries match your search." : `No entries for ${monthLabel(month)} yet.`}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={r.opted_out ? "opacity-60" : undefined}>
                  <TableCell className="font-mono text-[12px]">{r.entry_code}</TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {r.guest_name}
                      {r.opted_out && <Badge variant="destructive">Opted out</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{r.phone}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.host_name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.event_type_label}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.event_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{SOURCE_LABEL[r.source] ?? r.source}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px] text-muted-foreground">{fmtDateTime(r.created_at)}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {!r.opted_out && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setOptOutTarget(r)}
                        >
                          <BellOff className="size-3.5" /> Opt out
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total > 0
            ? `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} of ${total}`
            : "No entries"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <span className="tabular-nums">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Draw confirm — states the pool size */}
      <AlertDialog open={confirmDraw} onOpenChange={setConfirmDraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Draw the {monthLabel(month)} winner?</AlertDialogTitle>
            <AlertDialogDescription>
              {monthTotal === null
                ? "This will pick one winner at random from the eligible entries this month."
                : `This will pick one winner at random from ${monthTotal} ${monthTotal === 1 ? "entry" : "entries"} for ${monthLabel(month)} (opted-out entries are excluded). This cannot be undone without an admin re-draw.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runDraw}>Draw winner</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Re-draw confirm (admin) */}
      <AlertDialog open={confirmRedraw} onOpenChange={setConfirmRedraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-draw the {monthLabel(month)} winner?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the current winner for {monthLabel(month)} and lets you draw again. The action is logged for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reDraw} className="bg-destructive text-white hover:bg-destructive/90">
              Clear &amp; re-draw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Opt-out confirm (admin) */}
      <AlertDialog open={!!optOutTarget} onOpenChange={(o) => !o && setOptOutTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opt this guest out?</AlertDialogTitle>
            <AlertDialogDescription>
              {optOutTarget && (
                <>
                  This marks all draw entries for <span className="font-medium text-foreground">{optOutTarget.guest_name}</span>{" "}
                  ({optOutTarget.phone}) as opted-out. They will be excluded from all future draws. Use this when a guest replies “stop”.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOptOut} className="bg-destructive text-white hover:bg-destructive/90">
              Opt out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
