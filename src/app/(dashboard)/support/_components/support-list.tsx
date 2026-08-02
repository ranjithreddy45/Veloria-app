"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Inbox, Loader2, AlertTriangle, CheckCircle2, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createTicket, getTicketFormOptions, type TicketRow } from "@/actions/support.actions";
import {
  STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITIES,
  statusHue,
  priorityHue,
  fmtRelative,
} from "./support-format";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export function SupportList({
  tickets,
  canWrite,
}: {
  tickets: TicketRow[];
  canWrite: boolean;
}) {
  const [filter, setFilter] = React.useState("ALL");
  const [query, setQuery] = React.useState("");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const open = tickets.filter((t) => t.status === "OPEN").length;
  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const urgent = tickets.filter(
    (t) => t.priority === "URGENT" && t.status !== "RESOLVED" && t.status !== "CLOSED"
  ).length;
  const resolvedThisMonth = tickets.filter(
    (t) => t.status === "RESOLVED" && t.updatedAt >= monthStart
  ).length;

  const filtered = tickets.filter((t) => {
    if (filter !== "ALL" && t.status !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        (t.contactName ?? "").toLowerCase().includes(q) ||
        (t.assigneeName ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open" value={open} accent="blue" icon={<Inbox className="size-4" />} />
        <StatTile
          label="In progress"
          value={inProgress}
          accent="amber"
          icon={<Loader2 className="size-4" />}
        />
        <StatTile
          label="Urgent (active)"
          value={urgent}
          accent="rose"
          icon={<AlertTriangle className="size-4" />}
        />
        <StatTile
          label="Resolved this month"
          value={resolvedThisMonth}
          accent="emerald"
          icon={<CheckCircle2 className="size-4" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              options={FILTERS}
              value={filter}
              onChange={setFilter}
              ariaLabel="Filter tickets by status"
              size="sm"
            />
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search tickets…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-full sm:w-56"
              />
              {canWrite && <NewTicketDialog />}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<LifeBuoy className="size-6" />}
                title={tickets.length === 0 ? "No tickets yet" : "No tickets match"}
                description={
                  tickets.length === 0
                    ? canWrite
                      ? "Raise a ticket to start tracking a customer issue."
                      : "No support tickets have been raised yet."
                    : "Try a different filter or search term."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Ticket</th>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 font-medium">Priority</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Assignee</th>
                    <th className="px-4 py-2.5 font-medium">Contact</th>
                    <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="group border-b last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/support/${t.id}`}
                          className="font-mono text-xs font-medium hover:underline"
                        >
                          {t.ticketNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 max-w-[26rem]">
                        <Link href={`/support/${t.id}`} className="hover:underline">
                          <span className="line-clamp-1">{t.subject}</span>
                        </Link>
                        {t.category && (
                          <span className="mt-0.5 block text-meta text-muted-foreground">
                            {t.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          label={PRIORITY_LABEL[t.priority] ?? t.priority}
                          hue={priorityHue(t.priority)}
                          size="xs"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          label={STATUS_LABEL[t.status] ?? t.status}
                          hue={statusHue(t.status)}
                          size="xs"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {t.assigneeName ?? <span className="italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {t.contactName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                        {fmtRelative(t.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewTicketDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [contacts, setContacts] = React.useState<{ id: string; name: string }[]>([]);
  const [loadingOpts, setLoadingOpts] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [category, setCategory] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || contacts.length > 0) return;
    setLoadingOpts(true);
    getTicketFormOptions()
      .then((res) => {
        if (res.success) setContacts(res.data.contacts);
        else toast.error(res.error);
      })
      .finally(() => setLoadingOpts(false));
  }, [open, contacts.length]);

  async function handleCreate() {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSubmitting(true);
    const res = await createTicket({
      subject: subject.trim(),
      description: description.trim() || undefined,
      priority,
      category: category.trim() || undefined,
      contactId: contactId || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("Ticket created");
      setOpen(false);
      router.push(`/support/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New ticket
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New support ticket</DialogTitle>
          <DialogDescription>
            Capture a customer issue. You can assign and reply once it&apos;s open.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tkt-subject">Subject</Label>
            <Input
              id="tkt-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tkt-desc">Description</Label>
            <Textarea
              id="tkt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? (optional — becomes the first message)"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tkt-cat">Category</Label>
              <Input
                id="tkt-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Billing"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Contact</Label>
            <Select value={contactId} onValueChange={setContactId} disabled={loadingOpts}>
              <SelectTrigger>
                <SelectValue placeholder={loadingOpts ? "Loading…" : "Link a contact (optional)"} />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating…" : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
