"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2, LifeBuoy, Inbox, BookOpen, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import { createTicket, seedHelpdeskCategories } from "@/actions/hr-helpdesk.actions";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

export const HD_STATUS_HUE: Record<string, "slate" | "amber" | "blue" | "emerald" | "neutral"> = { OPEN: "slate", IN_PROGRESS: "amber", WAITING: "blue", RESOLVED: "emerald", CLOSED: "neutral" };
export const HD_STATUS_LABEL: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", WAITING: "Waiting", RESOLVED: "Resolved", CLOSED: "Closed" };
export const HD_PRIO_HUE: Record<string, "slate" | "blue" | "amber" | "red"> = { LOW: "slate", MEDIUM: "blue", HIGH: "amber", URGENT: "red" };

interface Ticket { id: string; number: number; subject: string; status: string; priority: string; createdAt: string; category: { name: string } | null; requesterId?: string; assigneeId?: string | null }
interface Cat { id: string; name: string; slaHours: number }
interface Article { id: string; title: string; body: string; isPublished: boolean; category: { name: string } | null }

export function HelpdeskHome({
  mine, assigned, isAgent, queue, requesters, categories, articles, canAdmin,
}: {
  mine: Ticket[]; assigned: Ticket[]; isAgent: boolean; queue: Ticket[]; requesters: Record<string, { name: string | null }>;
  categories: Cat[]; articles: Article[]; canAdmin: boolean;
}) {
  return (
    <Tabs defaultValue="mine">
      <TabsList className={TAB_LIST_SCROLL}>
        <TabsTrigger value="mine" className="gap-1.5"><LifeBuoy className="size-3.5" /> My tickets</TabsTrigger>
        {isAgent && <TabsTrigger value="queue" className="gap-1.5"><Headphones className="size-3.5" /> Agent queue{queue.length ? ` (${queue.length})` : ""}</TabsTrigger>}
        <TabsTrigger value="kb" className="gap-1.5"><BookOpen className="size-3.5" /> Knowledge base</TabsTrigger>
      </TabsList>

      <TabsContent value="mine" className="space-y-3">
        <div className="flex justify-end"><RaiseDialog categories={categories} /></div>
        {isAgent && assigned.length > 0 && (
          <div>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned to you</div>
            <TicketList tickets={assigned} />
          </div>
        )}
        <div>
          {isAgent && <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Raised by you</div>}
          {mine.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">No tickets yet. Raise one and HR will pick it up.</div>
          ) : <TicketList tickets={mine} />}
        </div>
      </TabsContent>

      {isAgent && (
        <TabsContent value="queue" className="space-y-3">
          {queue.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground"><Inbox className="mx-auto size-7 text-muted-foreground/40" /><p className="mt-2">Queue is clear 🎉</p></div>
          ) : <TicketList tickets={queue} showRequester requesters={requesters} />}
        </TabsContent>
      )}

      <TabsContent value="kb" className="space-y-3">
        {canAdmin && <div className="flex justify-end"><Button variant="outline" size="sm" asChild><Link href="/people/helpdesk?kb=new">Manage articles</Link></Button></div>}
        {articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">No articles yet. {canAdmin ? "Publish FAQs so staff self-serve." : ""}</div>
        ) : (
          <div className="space-y-2.5">
            {articles.map((a) => (
              <details key={a.id} className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer font-medium">{a.title}{a.category ? <span className="ml-2 text-[12px] font-normal text-muted-foreground">{a.category.name}</span> : null}{!a.isPublished && <StatusPill label="Draft" hue="slate" size="xs" className="ml-2" />}</summary>
                <p className="mt-2 whitespace-pre-wrap text-[13px] text-muted-foreground">{a.body}</p>
              </details>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function TicketList({ tickets, showRequester, requesters }: { tickets: Ticket[]; showRequester?: boolean; requesters?: Record<string, { name: string | null }> }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card divide-y">
      {tickets.map((t) => (
        <Link key={t.id} href={`/people/helpdesk/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
          <span className="text-[11.5px] font-medium text-muted-foreground tabular-nums">#{t.number}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{t.subject}</div>
            <div className="text-[12px] text-muted-foreground">
              {t.category?.name ?? "Uncategorised"}{showRequester && requesters?.[t.requesterId ?? ""] ? ` · ${requesters[t.requesterId!].name}` : ""} · {formatDate(t.createdAt)}
            </div>
          </div>
          <StatusPill label={t.priority[0] + t.priority.slice(1).toLowerCase()} hue={HD_PRIO_HUE[t.priority]} size="xs" />
          <StatusPill label={HD_STATUS_LABEL[t.status]} hue={HD_STATUS_HUE[t.status]} size="xs" />
        </Link>
      ))}
    </div>
  );
}

function RaiseDialog({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");

  async function submit() {
    setError(null);
    if (!subject.trim() || !description.trim()) { setError("Subject and details are required."); return; }
    setBusy(true);
    const res = await createTicket({ subject, description, categoryId: categoryId || undefined, priority });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setSubject(""); setDescription(""); setCategoryId("");
    router.push(`/people/helpdesk/${res.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="size-4" /> Raise a ticket</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Raise an HR ticket</DialogTitle><DialogDescription>Payroll, leave, IT access, documents — we’ll route it to the right person.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your request…" className="h-28 w-full resize-y rounded-md border bg-background p-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SeedCategoriesButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={async () => { setBusy(true); await seedHelpdeskCategories(); setBusy(false); router.refresh(); }}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Set up categories"}
    </Button>
  );
}
