"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Lock, Send, MessageSquare, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import {
  setTicketStatus,
  assignTicket,
  addTicketMessage,
  getTicketFormOptions,
  type TicketDTO,
} from "@/actions/support.actions";
import {
  STATUS_LABEL,
  PRIORITY_LABEL,
  STATUSES,
  statusHue,
  priorityHue,
  fmtDateTime,
} from "./support-format";

const UNASSIGNED = "__none__";

export function SupportDetail({
  ticket,
  canWrite,
}: {
  ticket: TicketDTO;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [staff, setStaff] = React.useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = React.useState(false);

  // Lazy-load assignable staff once (only needed when the agent can write).
  React.useEffect(() => {
    if (!canWrite || staff.length > 0) return;
    getTicketFormOptions().then((res) => {
      if (res.success) setStaff(res.data.staff);
    });
  }, [canWrite, staff.length]);

  async function changeStatus(next: string) {
    setBusy(true);
    const res = await setTicketStatus(ticket.id, next);
    setBusy(false);
    if (res.success) {
      toast.success(`Marked ${STATUS_LABEL[next] ?? next}`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function changeAssignee(userId: string) {
    setBusy(true);
    const res = await assignTicket(ticket.id, userId === UNASSIGNED ? "" : userId);
    setBusy(false);
    if (res.success) {
      toast.success("Assignee updated");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/support"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to tickets
        </Link>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono font-medium">{ticket.ticketNumber}</span>
                {ticket.category && <span>· {ticket.category}</span>}
              </div>
              <h1 className="text-xl font-semibold leading-tight">{ticket.subject}</h1>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <StatusPill
                  label={STATUS_LABEL[ticket.status] ?? ticket.status}
                  hue={statusHue(ticket.status)}
                  size="sm"
                />
                <StatusPill
                  label={PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
                  hue={priorityHue(ticket.priority)}
                  size="sm"
                />
                {ticket.contactName && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <UserIcon className="size-3" /> {ticket.contactName}
                  </span>
                )}
              </div>
            </div>

            {canWrite && (
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">Status</Label>
                  <Select value={ticket.status} onValueChange={changeStatus} disabled={busy}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">Assignee</Label>
                  <Select
                    value={ticket.assignedToId ?? UNASSIGNED}
                    onValueChange={changeAssignee}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Opened by</dt>
              <dd className="mt-0.5 font-medium">{ticket.createdByName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-0.5 font-medium">{fmtDateTime(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last activity</dt>
              <dd className="mt-0.5 font-medium">{fmtDateTime(ticket.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Resolved</dt>
              <dd className="mt-0.5 font-medium">
                {ticket.resolvedAt ? fmtDateTime(ticket.resolvedAt) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Thread */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="size-4" /> Conversation
          </h2>
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {ticket.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-lg border p-3",
                    m.internal
                      ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20"
                      : "bg-card"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      {m.authorName}
                      {m.internal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          <Lock className="size-2.5" /> Internal note
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {fmtDateTime(m.createdAt)}
                    </span>
                  </div>
                  {/* Plain-text render — newlines preserved, no HTML injection. */}
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                    {m.body}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {canWrite && (
            <>
              <Separator className="my-4" />
              <ReplyComposer ticketId={ticket.id} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReplyComposer({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSend() {
    if (!body.trim()) {
      toast.error("Write a message first");
      return;
    }
    setSubmitting(true);
    const res = await addTicketMessage(ticketId, { body: body.trim(), internal });
    setSubmitting(false);
    if (res.success) {
      setBody("");
      toast.success(internal ? "Internal note added" : "Reply sent");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={internal ? "Add an internal note (not shown to the customer)…" : "Write a reply…"}
        rows={3}
        className={cn(
          internal && "border-amber-300 focus-visible:ring-amber-400 dark:border-amber-900/60"
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={internal} onCheckedChange={setInternal} />
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lock className="size-3.5" /> Internal note
          </span>
        </label>
        <Button size="sm" onClick={handleSend} disabled={submitting}>
          <Send className="size-4" /> {submitting ? "Sending…" : internal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}
