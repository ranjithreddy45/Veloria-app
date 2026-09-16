"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { GuestResult } from "@/actions/guest-account.actions";
import { Card, Pill } from "../../../_components/ui";

const FIELD = "w-full rounded-xl border border-black/[.08] bg-white px-3.5 py-3 text-body focus:border-[#6d1b52] focus:outline-none";

type RequestRow = { id: string; kind: string; status: string; open: boolean; date: string };

type Props = {
  /** Labels already in the customer's words (worked out on the server). */
  requests: RequestRow[];
  hasOpenRequest: boolean;
  retentionYears: number;
  action: (note: string) => Promise<GuestResult<{ id: string }>>;
};

export function DeleteMyData({ requests, hasOpenRequest, retentionYears, action }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await action(note);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setNote("");
      setSent(true);
      router.refresh();
    } catch {
      setError("Couldn't send the request. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-2.5 overflow-hidden">
      <div className="px-4 py-3.5">
        <div className="text-copy">Delete my data</div>
        <p className="mt-1 text-detail leading-[1.5] text-[#6e6e73]">
          The team first confirms the request is really from you, then responds within 30 days. Invoices, payments and booking records are
          kept for {retentionYears} years, because tax law requires it.
        </p>
        {sent && <p className="mt-2 text-detail text-[#2a9d4a]">Your request has reached the team.</p>}
        {!hasOpenRequest && !open && (
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setOpen(true);
            }}
            className="mt-2.5 rounded-xl border border-[#b3261e]/30 px-4 py-2.5 text-body font-semibold text-[#b3261e]"
          >
            Ask to delete my data
          </button>
        )}
        {open && (
          <div className="vg-rise mt-2.5 flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1500}
              placeholder="Anything the team should know? (optional)"
              className={FIELD}
              aria-label="Note for the team"
            />
            <div className="flex gap-2">
              <button type="button" onClick={send} disabled={busy} className="flex-1 rounded-xl bg-[#b3261e] py-3 text-body font-semibold text-white disabled:opacity-60">
                {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Send request"}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-black/10 px-4 py-3 text-body font-medium">
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]">{error}</p>}
      </div>
      {requests.length > 0 && (
        <div className="vg-divide border-t border-black/[.06]">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium">{r.kind}</div>
                <div className="numeric text-meta text-[#636368]">Raised {r.date}</div>
              </div>
              <Pill tone={r.open ? "amber" : "grey"}>{r.status}</Pill>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
