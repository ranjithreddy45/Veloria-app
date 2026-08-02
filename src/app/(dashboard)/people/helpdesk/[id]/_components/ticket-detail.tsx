"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Lock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { addTicketComment, setTicketStatus, setTicketPriority, assignTicket } from "@/actions/hr-helpdesk.actions";
import { HD_STATUS_HUE, HD_STATUS_LABEL, HD_PRIO_HUE } from "../../_components/helpdesk-home";

interface Comment { id: string; body: string; isInternal: boolean; createdAt: string; authorId: string; author: { name: string | null; image: string | null } }
interface Ticket { id: string; number: number; subject: string; description: string; status: string; priority: string; createdAt: string; slaDueAt: string | null; category: { name: string } | null }

export function TicketDetail({
  ticket, comments, requester, assignee, isAgent, myId,
}: {
  ticket: Ticket; comments: Comment[]; requester: { name: string | null; image: string | null }; assignee: { name: string | null } | null; isAgent: boolean; myId: string;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    await addTicketComment(ticket.id, body, internal);
    setBusy(false); setBody(""); setInternal(false); router.refresh();
  }
  async function patch(fn: () => Promise<unknown>) { setBusy(true); await fn(); setBusy(false); router.refresh(); }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      {/* Thread */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-detail text-muted-foreground">#{ticket.number} · {ticket.category?.name ?? "Uncategorised"} · {formatDateTime(ticket.createdAt)}</div>
          <h2 className="mt-1 text-lg font-semibold">{ticket.subject}</h2>
          <p className="mt-2 whitespace-pre-wrap text-body text-muted-foreground">{ticket.description}</p>
        </div>

        {comments.map((c) => (
          <div key={c.id} className={cn("rounded-xl border p-4", c.isInternal ? "border-warning/20 bg-warning/10" : "bg-card")}>
            <div className="flex items-center gap-2">
              <Avatar size="sm"><AvatarImage src={c.author.image || undefined} /><AvatarFallback className="bg-primary/10 text-meta text-primary">{(c.author.name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <span className="text-body font-medium">{c.author.name ?? "—"}</span>
              {c.isInternal && <span className="inline-flex items-center gap-1 text-meta text-warning"><Lock className="size-3" /> Internal note</span>}
              <span className="ml-auto text-meta text-muted-foreground">{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-body">{c.body}</p>
          </div>
        ))}

        {/* Reply */}
        {ticket.status !== "CLOSED" && (
          <div className="rounded-xl border bg-card p-3">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" className="h-20 w-full resize-y rounded-md border bg-background p-2.5 text-body outline-none focus:ring-2 focus:ring-ring" />
            {/* "Internal note (hidden from requester)" plus Send is wider than
              * the card on a phone — wrap so Send is never pushed off. */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {isAgent ? (
                <label className="flex items-center gap-2 text-detail text-muted-foreground"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="size-4" /> Internal note (hidden from requester)</label>
              ) : <span />}
              <Button onClick={send} disabled={busy || !body.trim()} size="sm" className="gap-1.5">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Send</Button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-3">
        <div className="rounded-xl border bg-card p-4 space-y-3 text-body">
          <Row label="Status"><StatusPill label={HD_STATUS_LABEL[ticket.status]} hue={HD_STATUS_HUE[ticket.status]} size="xs" /></Row>
          <Row label="Priority"><StatusPill label={ticket.priority[0] + ticket.priority.slice(1).toLowerCase()} hue={HD_PRIO_HUE[ticket.priority]} size="xs" /></Row>
          <Row label="Requester"><span className="font-medium">{requester.name ?? "—"}</span></Row>
          <Row label="Assignee"><span className="font-medium">{assignee?.name ?? "Unassigned"}</span></Row>
          {ticket.slaDueAt && <Row label="SLA due"><span className="text-muted-foreground">{formatDateTime(ticket.slaDueAt)}</span></Row>}
        </div>

        {isAgent && (
          <div className="rounded-xl border bg-card p-4 space-y-2.5">
            <div className="text-detail font-semibold uppercase tracking-wide text-muted-foreground">Agent controls</div>
            <Button variant="outline" size="sm" className="w-full gap-1.5" disabled={busy} onClick={() => patch(() => assignTicket(ticket.id, myId))}><UserCheck className="size-3.5" /> Assign to me</Button>
            <Select value={ticket.status} onValueChange={(v) => patch(() => setTicketStatus(ticket.id, v))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(HD_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ticket.priority} onValueChange={(v) => patch(() => setTicketPriority(ticket.id, v))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {!isAgent && ticket.status !== "CLOSED" && (
          <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => patch(() => setTicketStatus(ticket.id, "CLOSED"))}>Close ticket</Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span>{children}</div>;
}
