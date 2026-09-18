"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { GuestReferralRow, GuestResult } from "@/actions/guest-account.actions";

// Server actions arrive as props from the server page, so nothing here
// imports a module that pulls in the notification sender.

const FIELD = "w-full rounded-xl border border-black/[.08] bg-white px-3.5 py-3 text-body focus:border-[#6d1b52] focus:outline-none";
const DARK_FIELD =
  "w-full rounded-xl border border-white/25 bg-white/10 px-3.5 py-3 text-body text-[#fdf5f3] placeholder:text-[#fdf5f3]/50 focus:border-[#e8b631] focus:outline-none";

type RedeemAction = (input: { bookingId: string; points: number; note: string }) => Promise<GuestResult<{ id: string }>>;

/** Ask the coordinator to use points. Nothing is deducted until the team applies it. */
export function RedeemPoints({ bookingId, balance, action }: { bookingId: string; balance: number; action: RedeemAction }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [points, setPoints] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await action({ bookingId, points: Number(points), note });
      if (!res.success) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setOpen(false);
      setPoints("");
      setNote("");
      setMessage({ ok: true, text: "Sent to your coordinator. They confirm before any points are used." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Couldn't send. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2.5">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
          className="vg-press w-full rounded-2xl border border-black/[.06] bg-white p-4 text-left text-body font-semibold text-[#6d1b52]"
        >
          Ask to use points
        </button>
      ) : (
        <div className="vg-rise flex flex-col gap-2 rounded-2xl border border-black/[.06] bg-white p-4">
          <label className="text-meta text-[#6e6e73]" htmlFor="redeem-points">
            How many points? You have {balance.toLocaleString("en-IN")}.
          </label>
          <input
            id="redeem-points"
            className={FIELD}
            type="number"
            inputMode="numeric"
            min={1}
            max={balance}
            step={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            autoFocus
          />
          <textarea
            className={FIELD}
            rows={2}
            maxLength={500}
            placeholder="What would you like to use them for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="What would you like to use them for?"
          />
          <div className="flex gap-2">
            <button type="button" onClick={send} disabled={busy} className="flex-1 rounded-xl bg-[#6d1b52] py-3 text-body font-semibold text-[#fdf5f3] disabled:opacity-60">
              {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Send to coordinator"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-black/10 px-4 py-3 text-body font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={message.ok ? "mt-2 text-meta text-[#2a9d4a]" : "mt-2 rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]"}>{message.text}</p>
      )}
    </div>
  );
}

type ReferralAction = (input: { name: string; phone: string; email?: string }) => Promise<GuestResult<GuestReferralRow>>;

/** Introduce a friend: a Referral the team works from /referrals. */
export function IntroduceFriend({ disabled, action }: { disabled: boolean; action: ReferralAction }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await action({ name, phone, email: email.trim() || undefined });
      if (!res.success) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setName("");
      setPhone("");
      setEmail("");
      setOpen(false);
      setMessage({ ok: true, text: "Thank you. The team will reach out to them." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Couldn't send. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[18px] bg-[#6d1b52] p-4 text-[#fdf5f3]">
      <div className="flex items-center gap-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">Introduce a friend</div>
          <div className="mt-0.5 text-detail leading-[1.5] text-[#fdf5f3]/75">Give us their name and number, and the team takes it from there.</div>
        </div>
        {!open && !disabled && (
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setOpen(true);
            }}
            className="shrink-0 rounded-full bg-[#fdf5f3] px-3.5 py-2 text-detail font-semibold text-[#6d1b52]"
          >
            Refer
          </button>
        )}
      </div>
      {open && (
        <div className="vg-rise mt-3 flex flex-col gap-2">
          <input className={DARK_FIELD} placeholder="Friend's name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          <input className={DARK_FIELD} type="tel" inputMode="tel" placeholder="Their mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
          <input className={DARK_FIELD} type="email" inputMode="email" placeholder="Their email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
          <div className="flex gap-2">
            <button type="button" onClick={send} disabled={busy} className="flex-1 rounded-xl bg-[#fdf5f3] py-3 text-body font-semibold text-[#6d1b52] disabled:opacity-60">
              {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Send introduction"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-white/30 px-4 py-3 text-body font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <p className={`mt-2.5 text-detail ${message.ok ? "text-[#f3d489]" : "text-[#ffb4ae]"}`}>{message.text}</p>}
    </div>
  );
}

/** The customer's own /refer link, with a copy button. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-detail text-[#1d1d1f]">{url}</span>
      <button type="button" onClick={copy} className="shrink-0 rounded-xl border border-black/10 px-3.5 py-2.5 text-detail font-semibold text-[#6d1b52]">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
