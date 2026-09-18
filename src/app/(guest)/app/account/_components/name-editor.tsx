"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { GuestResult, NameChangeOutcome } from "@/actions/guest-account.actions";

const FIELD = "w-full rounded-xl border border-black/[.08] bg-white px-3.5 py-3 text-body focus:border-[#6d1b52] focus:outline-none";

const OUTCOME: Record<NameChangeOutcome, string> = {
  UPDATED: "Saved. Your booking details show this name too.",
  SENT_TO_TEAM: "Saved to your account. Invoices and contracts keep the name they were issued with, so we've asked the team to update their records.",
  NONE: "Saved.",
};

type Props = {
  name: string | null;
  disabled: boolean;
  action: (name: string) => Promise<GuestResult<{ name: string; contact: NameChangeOutcome }>>;
};

export function NameEditor({ name, disabled, action }: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(name ?? "");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await action(value);
      if (!res.success) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setEditing(false);
      setMessage({ ok: true, text: OUTCOME[res.data.contact] });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Couldn't save. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-meta text-[#6e6e73]">Name</div>
          {!editing && <div className="mt-0.5 truncate text-copy">{name ?? "Not set"}</div>}
        </div>
        {!editing && !disabled && (
          <button
            type="button"
            onClick={() => {
              setValue(name ?? "");
              setMessage(null);
              setEditing(true);
            }}
            className="shrink-0 text-detail font-semibold text-[#6d1b52]"
          >
            Edit
          </button>
        )}
      </div>
      {editing && (
        <div className="vg-rise mt-2 flex flex-col gap-2">
          <input className={FIELD} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="name" maxLength={120} autoFocus aria-label="Your name" />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="flex-1 rounded-xl bg-[#6d1b52] py-3 text-body font-semibold text-[#fdf5f3] disabled:opacity-60">
              {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy} className="rounded-xl border border-black/10 px-4 py-3 text-body font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={message.ok ? "mt-2 text-detail leading-[1.5] text-[#2a9d4a]" : "mt-2 rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
