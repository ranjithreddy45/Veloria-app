"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, ShieldAlert, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  anonymiseContact,
  searchContactsForPrivacy,
  updatePrivacyRequest,
  type PrivacyContactMatch,
  type PrivacyRequestRow,
} from "@/actions/privacy.actions";
import {
  PRIVACY_REQUEST_KIND_LABEL,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_STATUS_LABEL,
  type PrivacyRequestStatus,
} from "@/lib/privacy/policy";

// ============================================================
// Privacy request queue — one card per request. Admin flow:
//   verify identity → (DELETE only) anonymise the contact → close with a note.
// ============================================================

const STATUS_BADGE: Record<PrivacyRequestStatus, "warning" | "secondary" | "success" | "destructive"> = {
  OPEN: "warning",
  IN_PROGRESS: "secondary",
  DONE: "success",
  REJECTED: "destructive",
};

const KIND_BADGE: Record<PrivacyRequestRow["kind"], "default" | "destructive" | "secondary"> = {
  ACCESS: "default",
  DELETE: "destructive",
  CORRECT: "secondary",
};

type Filter = PrivacyRequestStatus | "ALL";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function PrivacyQueue({ requests }: { requests: PrivacyRequestRow[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const visible =
    filter === "ALL"
      ? requests
      : requests.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", ...PRIVACY_REQUEST_STATUSES] as Filter[]).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All" : PRIVACY_REQUEST_STATUS_LABEL[f]}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-body text-muted-foreground">
          No requests {filter === "ALL" ? "yet" : `with status “${PRIVACY_REQUEST_STATUS_LABEL[filter as PrivacyRequestStatus]}”`}.
        </p>
      ) : (
        <ul className="space-y-4">
          {visible.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({ request: r }: { request: PrivacyRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PrivacyRequestStatus>(r.status);
  const [note, setNote] = useState(r.resolutionNote ?? "");
  const [verified, setVerified] = useState(!!r.verifiedAt);
  const closed = r.status === "DONE" || r.status === "REJECTED";

  function save() {
    startTransition(async () => {
      const res = await updatePrivacyRequest({
        id: r.id,
        status,
        resolutionNote: note,
        verified,
      });
      if (res.success) {
        toast.success("Request updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={KIND_BADGE[r.kind]}>{PRIVACY_REQUEST_KIND_LABEL[r.kind]}</Badge>
            <Badge variant={STATUS_BADGE[r.status]}>{PRIVACY_REQUEST_STATUS_LABEL[r.status]}</Badge>
            {r.verifiedAt ? (
              <span className="text-meta text-success">Identity verified {fmt(r.verifiedAt)}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-meta text-warning">
                <ShieldAlert className="size-3.5" /> Not yet verified
              </span>
            )}
          </div>
          <p className="text-copy font-semibold text-foreground">{r.requesterName}</p>
          <p className="text-detail text-muted-foreground">
            {[r.requesterEmail, r.requesterPhone].filter(Boolean).join(" · ") || "No contact details given"}
          </p>
        </div>
        <div className="text-right text-meta text-muted-foreground">
          <p>Raised {fmt(r.createdAt)}</p>
          {r.handledAt ? (
            <p>
              Closed {fmt(r.handledAt)}
              {r.handledByName ? ` by ${r.handledByName}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {r.details ? (
        <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/40 p-3 text-body text-foreground/90">
          {r.details}
        </p>
      ) : null}

      {/* Erasure tooling — only meaningful for DELETE requests */}
      {r.kind === "DELETE" && !closed ? <AnonymisePanel request={r} /> : null}

      {/* Work the request */}
      <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`status-${r.id}`}>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PrivacyRequestStatus)}>
            <SelectTrigger id={`status-${r.id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIVACY_REQUEST_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PRIVACY_REQUEST_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-detail text-muted-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            Identity verified (replied from their email / phone)
          </label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note-${r.id}`}>Resolution note</Label>
          <Textarea
            id={`note-${r.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What was done, or why it was rejected. Required to close."
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AnonymisePanel({ request: r }: { request: PrivacyRequestRow }) {
  const router = useRouter();
  const [searching, startSearch] = useTransition();
  const [running, startRun] = useTransition();
  const [q, setQ] = useState(r.requesterEmail ?? r.requesterPhone ?? "");
  const [matches, setMatches] = useState<PrivacyContactMatch[] | null>(null);
  const [picked, setPicked] = useState<PrivacyContactMatch | null>(null);
  const [confirming, setConfirming] = useState(false);

  function search() {
    startSearch(async () => {
      const res = await searchContactsForPrivacy(q);
      if (res.success) {
        setMatches(res.data);
        setPicked(null);
        setConfirming(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function run() {
    if (!picked) return;
    startRun(async () => {
      const res = await anonymiseContact({ contactId: picked.id, requestId: r.id });
      if (res.success) {
        toast.success("Contact anonymised. Financial records were kept.");
        setConfirming(false);
        setPicked(null);
        setMatches(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
      <p className="flex items-center gap-1.5 text-body font-medium text-foreground">
        <UserX className="size-4 text-destructive" /> Anonymise the contact
      </p>
      <p className="text-detail text-muted-foreground">
        Replaces name, email, phone, address and notes with placeholders and scrubs linked form
        submissions and consent rows. Invoices, payments and bookings stay intact (tax law). Verify
        identity first — this cannot be undone.
      </p>
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, phone or name"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={search} disabled={searching || q.trim().length < 3}>
          {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Find
        </Button>
      </div>

      {matches ? (
        matches.length === 0 ? (
          <p className="text-detail text-muted-foreground">No matching contact.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/80 bg-card">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="radio"
                    name={`anon-${r.id}`}
                    className="size-4 shrink-0"
                    checked={picked?.id === m.id}
                    disabled={m.anonymised}
                    onChange={() => {
                      setPicked(m);
                      setConfirming(false);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium text-foreground">
                      {m.name}
                      {m.anonymised ? (
                        <span className="ml-2 text-meta text-muted-foreground">(already anonymised)</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-meta text-muted-foreground">
                      {[m.email, m.phone].filter(Boolean).join(" · ") || "no email / phone"} ·{" "}
                      {m.bookings} booking{m.bookings === 1 ? "" : "s"}, {m.invoices} invoice
                      {m.invoices === 1 ? "" : "s"}
                    </span>
                  </span>
                </label>
                <Link
                  href={`/contacts/${m.id}`}
                  target="_blank"
                  className="shrink-0 text-body font-medium text-primary hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {picked ? (
        confirming ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50 p-2.5 dark:border-amber-800/50 dark:bg-amber-950/40">
            <span className="text-meta text-amber-800 dark:text-amber-300">
              Anonymise <strong>{picked.name}</strong> now? Their identifiers are removed for good;
              their {picked.invoices} invoice{picked.invoices === 1 ? "" : "s"} stay on file.
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={running}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={run} disabled={running}>
                {running ? "Anonymising…" : "Confirm anonymise"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              Anonymise {picked.name}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
