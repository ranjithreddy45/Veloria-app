"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Send, Trash2, Users, Loader2, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  portalAddGuest, portalBulkImportGuests, portalRemoveGuest,
  portalSendInvitation, portalBulkSendInvitations,
} from "@/actions/portal-guest.actions";

type InviteStatus = "NOT_SENT" | "SENT" | "DELIVERED" | "OPENED" | "RSVP_ACCEPTED" | "RSVP_DECLINED";
type Rsvp = "PENDING" | "ACCEPTED" | "DECLINED";

export interface PortalGuest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string;
  plusOnes: number;
  rsvpStatus: Rsvp;
  invitation: { invitationStatus: InviteStatus; sentAt: string | null } | null;
}

interface Stats { total: number; invited: number; accepted: number; declined: number; pending: number; sent: number }

const CATEGORIES = ["VIP", "FAMILY", "FRIEND", "CORPORATE", "OTHER"];

export function PortalGuestManager({
  bookingId, eventName, guests, stats,
}: {
  bookingId: string;
  eventName: string;
  guests: PortalGuest[];
  stats: Stats;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Add-guest form
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [category, setCategory] = React.useState("OTHER");
  const [plusOnes, setPlusOnes] = React.useState(0);

  const [showImport, setShowImport] = React.useState(false);
  const [importText, setImportText] = React.useState("");

  function refresh() { router.refresh(); }

  function addGuest() {
    if (!name.trim()) { toast.error("Guest name is required."); return; }
    startTransition(async () => {
      const res = await portalAddGuest(bookingId, {
        name: name.trim(), phone: phone.trim(), email: email.trim(), category, plusOnes: Number(plusOnes) || 0,
      });
      if (res.success) {
        toast.success(`${name.trim()} added.`);
        setName(""); setPhone(""); setEmail(""); setCategory("OTHER"); setPlusOnes(0);
        refresh();
      } else toast.error(res.error);
    });
  }

  function doImport() {
    // One guest per line: "Name, phone, email" (phone/email optional).
    const rows = importText.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [n, p, e] = line.split(",").map((x) => x.trim());
      return { name: n, phone: p || undefined, email: e || undefined, category: "OTHER" as const, plusOnes: 0 };
    }).filter((r) => r.name);
    if (rows.length === 0) { toast.error("Paste at least one guest (Name, phone, email)."); return; }
    startTransition(async () => {
      const res = await portalBulkImportGuests(bookingId, { guests: rows });
      if (res.success) {
        toast.success(`${res.data.count} guest${res.data.count === 1 ? "" : "s"} imported.`);
        setImportText(""); setShowImport(false); refresh();
      } else toast.error(res.error);
    });
  }

  function sendOne(g: PortalGuest) {
    setBusyId(g.id);
    startTransition(async () => {
      const res = await portalSendInvitation(bookingId, g.id);
      setBusyId(null);
      if (res.success) { toast.success(`Invitation sent to ${g.name}.`); refresh(); }
      else toast.error(res.error);
    });
  }

  function sendAll() {
    startTransition(async () => {
      const res = await portalBulkSendInvitations(bookingId);
      if (res.success) {
        toast.success(`${res.data.sent} invitation${res.data.sent === 1 ? "" : "s"} sent${res.data.skipped ? ` · ${res.data.skipped} skipped` : ""}.`);
        refresh();
      } else toast.error(res.error);
    });
  }

  function remove(g: PortalGuest) {
    if (!confirm(`Remove ${g.name} from your guest list?`)) return;
    setBusyId(g.id);
    startTransition(async () => {
      const res = await portalRemoveGuest(bookingId, g.id);
      setBusyId(null);
      if (res.success) { toast.success(`${g.name} removed.`); refresh(); }
      else toast.error(res.error);
    });
  }

  const unsent = guests.filter((g) => g.phone && (!g.invitation || g.invitation.invitationStatus === "NOT_SENT")).length;

  return (
    <div className="space-y-6">
      {/* RSVP summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Invited" value={stats.invited} tone="zinc" icon={<Users className="size-4" />} />
        <Stat label="Accepted" value={stats.accepted} tone="emerald" icon={<CheckCircle2 className="size-4" />} />
        <Stat label="Declined" value={stats.declined} tone="rose" icon={<XCircle className="size-4" />} />
        <Stat label="Pending" value={stats.pending} tone="amber" icon={<Clock className="size-4" />} />
        <Stat label="Invites sent" value={stats.sent} tone="indigo" icon={<Send className="size-4" />} />
      </div>

      {/* Add + import */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="size-4 text-indigo-600" /> Add a guest</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowImport((s) => !s)} className="gap-1.5 text-xs">
            <Upload className="size-3.5" /> Bulk paste
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-6">
          <div className="sm:col-span-2"><Label className="sr-only">Name</Label><Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="number" min={0} max={20} title="Plus ones" value={plusOnes} onChange={(e) => setPlusOnes(Number(e.target.value))} className="w-16" />
            <Button onClick={addGuest} disabled={pending} className="flex-1 gap-1.5">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Add
            </Button>
          </div>
        </div>
        {showImport && (
          <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <Label className="text-xs text-zinc-500">One guest per line — <code>Name, phone, email</code> (phone &amp; email optional)</Label>
            <Textarea rows={4} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={"Aarav Sharma, 98765 43210, aarav@example.com\nPriya Nair, 99887 76655"} />
            <Button size="sm" onClick={doImport} disabled={pending} className="gap-1.5">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import guests
            </Button>
          </div>
        )}
      </div>

      {/* Guest list */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Guests <span className="text-zinc-400">({stats.total})</span></h2>
          {unsent > 0 && (
            <Button size="sm" onClick={sendAll} disabled={pending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send all invitations ({unsent})
            </Button>
          )}
        </div>
        {guests.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">No guests yet — add your first above.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {guests.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 p-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {g.name}{g.plusOnes > 0 && <span className="ml-1 text-xs text-zinc-400">+{g.plusOnes}</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{[g.phone, g.email].filter(Boolean).join(" · ") || "No contact info"}</p>
                </div>
                <RsvpBadge status={g.rsvpStatus} />
                <InviteBadge status={g.invitation?.invitationStatus ?? "NOT_SENT"} />
                <div className="flex items-center gap-1">
                  {(!g.invitation || g.invitation.invitationStatus === "NOT_SENT") ? (
                    <Button size="sm" variant="outline" disabled={pending || !g.phone} onClick={() => sendOne(g)} className="h-8 gap-1.5" title={g.phone ? "Send invitation" : "Add a phone number first"}>
                      {busyId === g.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Invite
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => sendOne(g)} className="h-8 gap-1.5 text-xs text-zinc-500" title="Resend invitation">
                      Resend
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" disabled={pending} onClick={() => remove(g)} className="size-8 text-zinc-400 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  const tones: Record<string, string> = {
    zinc: "text-zinc-600 dark:text-zinc-300", emerald: "text-emerald-600", rose: "text-rose-600",
    amber: "text-amber-600", indigo: "text-indigo-600",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${tones[tone]}`}>{icon}{label}</div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function RsvpBadge({ status }: { status: Rsvp }) {
  const map: Record<Rsvp, { label: string; cls: string }> = {
    ACCEPTED: { label: "Accepted", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    DECLINED: { label: "Declined", cls: "border-rose-200 bg-rose-50 text-rose-700" },
    PENDING: { label: "Awaiting RSVP", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  };
  const m = map[status];
  return <Badge variant="outline" className={`hidden sm:inline-flex ${m.cls}`}>{m.label}</Badge>;
}

function InviteBadge({ status }: { status: InviteStatus }) {
  if (status === "NOT_SENT") return <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-500">Not invited</Badge>;
  return <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Invited</Badge>;
}
