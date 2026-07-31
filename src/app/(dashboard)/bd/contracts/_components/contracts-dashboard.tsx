"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  FileText,
  IndianRupee,
  TrendingUp,
  CalendarDays,
  Search,
  FilePen,
  BadgeCheck,
  Handshake,
  PenLine,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile, type Accent } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { StatusPill } from "@/components/shared/status-pill";
import {
  ACQ_CONTRACT_LIFECYCLE,
  ACQ_CONTRACT_LIFECYCLE_LABEL,
  ACQ_CONTRACT_PHASE_LABEL,
} from "@/lib/acq/constants";
import { createAcqContract } from "@/actions/acq-contract.actions";

export interface ContractRow {
  id: string;
  contractNumber?: string | null;
  title: string;
  propertyName: string;
  ownerName: string;
  status: string;
  phase: string;
  contractValue?: number | string | null;
  signByDate?: string | null;
}
export interface ContractStatsData {
  byStatus: Record<string, number>;
  upcomingValue: number;
  activeValue: number;
  terminatedGainLoss: number;
  upcomingSignings: { id: string; title: string; signByDate: string }[];
  activityByType: Record<string, number>;
}
export interface DealOption {
  id: string;
  name: string;
  propertyName: string;
  ownerName?: string;
  contractValue?: number | null;
  model?: string | null;
  baseFeePct?: number | null;
  incentivePct?: number | null;
  termYears?: number | null;
}

const STATUS_HUE: Record<string, "slate" | "blue" | "indigo" | "emerald" | "amber" | "rose"> = {
  DRAFT: "slate",
  APPROVED: "indigo",
  NEGOTIATED: "amber",
  SIGNED: "blue",
  ACTIVE: "emerald",
  TERMINATED: "rose",
};

// StatTile accents + icons kept in step with the StatusPill hues above so the
// same status reads the same colour everywhere on the page.
const STATUS_ACCENT: Record<string, Accent> = {
  DRAFT: "cyan",
  APPROVED: "indigo",
  NEGOTIATED: "amber",
  SIGNED: "blue",
  ACTIVE: "emerald",
  TERMINATED: "rose",
};
const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  DRAFT: FilePen,
  APPROVED: BadgeCheck,
  NEGOTIATED: Handshake,
  SIGNED: PenLine,
  ACTIVE: CheckCircle2,
  TERMINATED: XCircle,
};

function inr(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ContractsDashboard({
  contracts,
  stats,
  deals,
  userRole,
}: {
  contracts: ContractRow[];
  stats: ContractStatsData | null;
  deals: DealOption[];
  userRole?: string;
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("ALL");
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return contracts.filter((c) => {
      if (filter !== "ALL" && c.status !== filter) return false;
      if (!term) return true;
      return (
        c.title.toLowerCase().includes(term) ||
        c.propertyName.toLowerCase().includes(term) ||
        c.ownerName.toLowerCase().includes(term) ||
        (c.contractNumber ?? "").toLowerCase().includes(term)
      );
    });
  }, [contracts, filter, q]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI tiles. Three of the four are rupee figures and StatTile renders its
        * value at 28px inside an overflow-hidden card — a half-width tile at
        * 375px has ~125px of usable width, which silently clips
        * "₹1,25,00,000". Money rows stack on a phone, 2-up from sm: onward. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active contract value" value={inr(stats?.activeValue ?? 0)} accent="emerald" icon={<IndianRupee className="size-4" />} />
        <StatTile label="Upcoming value" value={inr(stats?.upcomingValue ?? 0)} accent="indigo" icon={<FileText className="size-4" />} />
        <StatTile
          label="Terminated gain / loss"
          value={inr(stats?.terminatedGainLoss ?? 0)}
          accent={(stats?.terminatedGainLoss ?? 0) < 0 ? "rose" : "emerald"}
          icon={<TrendingUp className="size-4" />}
        />
        <StatTile label="Total contracts" value={contracts.length} accent="gold" icon={<CalendarDays className="size-4" />} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          Contracts by status
          <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">click a tile to filter</span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, title, property, owner…"
              className="h-9 w-full pl-9"
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="size-3.5" /> New
          </Button>
        </div>
      </div>

      {/* Status tiles — click to filter, click again to clear */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ACQ_CONTRACT_LIFECYCLE.map((s) => {
          const Icon = STATUS_ICON[s] ?? FileText;
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? "ALL" : s)}
              className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StatTile
                label={ACQ_CONTRACT_LIFECYCLE_LABEL[s]}
                value={stats?.byStatus[s] ?? 0}
                accent={STATUS_ACCENT[s] ?? "indigo"}
                icon={<Icon className="size-4" />}
                className={cn("h-full", active && "ring-2 ring-primary/50")}
              />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Contract list */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardContent className="px-0 py-0">
            <h2 className="px-5 py-4 text-[13px] font-semibold tracking-[-0.01em] text-foreground">Contracts</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Contract</th>
                    <th className="px-3 py-2 font-medium">Phase</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                    <th className="px-3 py-2 font-medium">Sign by</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">No contracts.</td></tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <Link href={`/bd/contracts/${c.id}`} className="font-medium text-foreground hover:underline">
                            {c.title}
                          </Link>
                          <div className="text-[11.5px] text-muted-foreground">
                            {c.contractNumber ? `${c.contractNumber} · ` : ""}{c.propertyName} · {c.ownerName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{ACQ_CONTRACT_PHASE_LABEL[c.phase as keyof typeof ACQ_CONTRACT_PHASE_LABEL] ?? c.phase}</td>
                        <td className="px-3 py-2.5">
                          <StatusPill label={ACQ_CONTRACT_LIFECYCLE_LABEL[c.status as keyof typeof ACQ_CONTRACT_LIFECYCLE_LABEL] ?? c.status} hue={STATUS_HUE[c.status] ?? "slate"} size="xs" />
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{c.contractValue ? inr(Number(c.contractValue)) : "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(c.signByDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Right column: signing calendar + activity */}
        <div className="flex flex-col gap-5">
          <Card className="gap-0 py-0">
            <CardContent className="space-y-3 px-5 py-5 text-[13px]">
              <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Signing calendar</h2>
              <MonthCalendar signings={stats?.upcomingSignings ?? []} />
              <div className="space-y-1.5 border-t border-border/50 pt-2">
                {stats && stats.upcomingSignings.length > 0 ? (
                  stats.upcomingSignings.slice(0, 6).map((s) => (
                    <Link key={s.id} href={`/bd/contracts/${s.id}`} className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/40">
                      <span className="truncate pr-2 text-foreground">{s.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(s.signByDate)}</span>
                    </Link>
                  ))
                ) : (
                  <p className="text-muted-foreground">No upcoming signings.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardContent className="space-y-1.5 px-5 py-5 text-[13px]">
              <h2 className="pb-1.5 text-[13px] font-semibold tracking-[-0.01em] text-foreground">Activity (90 days)</h2>
              {stats && Object.keys(stats.activityByType).length > 0 ? (
                Object.entries(stats.activityByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{type.replaceAll("_", " ")}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateContractDialog deals={deals} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function MonthCalendar({ signings }: { signings: { id: string; title: string; signByDate: string }[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // 0=Sun
  const today = now.getDate();

  // Map day-of-month → signing count (only for the current month).
  const byDay = new Map<number, number>();
  for (const s of signings) {
    const d = new Date(s.signByDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDay.set(d.getDate(), (byDay.get(d.getDate()) ?? 0) + 1);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="pb-1.5 text-center text-[12px] font-medium text-foreground">
        {first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (<div key={i} className="py-0.5">{d}</div>))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const count = byDay.get(d) ?? 0;
          const isToday = d === today;
          return (
            <div
              key={i}
              className={`relative rounded py-1 text-[11px] ${count > 0 ? "bg-violet-100 font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" : isToday ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}
              title={count > 0 ? `${count} signing${count > 1 ? "s" : ""}` : undefined}
            >
              {d}
              {count > 0 && <span className="absolute right-0.5 top-0.5 size-1 rounded-full bg-violet-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateContractDialog({ deals, open, onOpenChange }: { deals: DealOption[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [dealId, setDealId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [propertyName, setPropertyName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPhone, setOwnerPhone] = React.useState("");
  const [contractValue, setContractValue] = React.useState("");
  const [signByDate, setSignByDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDealId(""); setTitle(""); setOwnerName(""); setPropertyName("");
      setOwnerEmail(""); setOwnerPhone(""); setContractValue(""); setSignByDate("");
    }
  }, [open]);

  const selectedDeal = deals.find((d) => d.id === dealId);

  // Pre-fill the form from the chosen deal so known commercials aren't re-keyed
  // (audit O-1/O-2). Owner email/phone aren't carried on the deal, so they stay
  // manual. The user can still override any pre-filled value before creating.
  function selectDeal(id: string) {
    setDealId(id);
    const d = deals.find((x) => x.id === id);
    if (d) {
      setOwnerName(d.ownerName ?? "");
      setPropertyName(d.propertyName ?? "");
      setTitle(`Management Agreement — ${d.propertyName}`);
      setContractValue(d.contractValue != null ? String(d.contractValue) : "");
    }
  }

  async function create() {
    setBusy(true);
    try {
      const res = await createAcqContract({
        dealId: dealId || undefined,
        title: title.trim() || undefined,
        ownerName: ownerName.trim() || undefined,
        propertyName: propertyName.trim() || undefined,
        ownerEmail: ownerEmail.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        contractValue: contractValue ? Number(contractValue) : undefined,
        signByDate: signByDate || undefined,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Contract created");
      onOpenChange(false);
      router.push(`/bd/contracts/${res.data.id}`);
    } catch {
      toast.error("Couldn't create — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New contract</DialogTitle>
          <DialogDescription>Auto-fill from an agreed deal, or enter the details manually.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>From deal (auto-populate)</Label>
            <Select value={dealId || undefined} onValueChange={selectDeal}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select an agreed deal (optional)…" /></SelectTrigger>
              <SelectContent>
                {deals.length === 0 ? (
                  <div className="px-2 py-1.5 text-[12.5px] text-muted-foreground">No agreed deals yet.</div>
                ) : (
                  deals.map((d) => (<SelectItem key={d.id} value={d.id}>{d.propertyName} — {d.name}</SelectItem>))
                )}
              </SelectContent>
            </Select>
            {selectedDeal && (
              <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[12px] text-muted-foreground">
                Inheriting from deal:{" "}
                <span className="font-medium text-foreground">{selectedDeal.model ?? "model —"}</span>
                {" · "}base {selectedDeal.baseFeePct != null ? `${selectedDeal.baseFeePct}%` : "—"}
                {" · "}incentive {selectedDeal.incentivePct != null ? `${selectedDeal.incentivePct}%` : "—"}
                {" · "}term {selectedDeal.termYears != null ? `${selectedDeal.termYears}y` : "—"}. Owner email & phone aren’t on the deal — add them below.
              </p>
            )}
          </div>
          <div className="space-y-1.5"><Label>Owner name</Label><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Property name</Label><Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Title (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Management Agreement — …" /></div>
          <div className="space-y-1.5"><Label>Owner email</Label><Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Owner phone</Label><Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Contract value (₹)</Label><Input inputMode="numeric" value={contractValue} onChange={(e) => setContractValue(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Target sign date</Label><Input type="date" value={signByDate} onChange={(e) => setSignByDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create contract"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
