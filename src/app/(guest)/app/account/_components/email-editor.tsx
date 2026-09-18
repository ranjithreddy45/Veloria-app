"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { GuestResult, PendingEmail } from "@/actions/guest-account.actions";
import { Pill } from "../../../_components/ui";

const FIELD = "w-full rounded-xl border border-black/[.08] bg-white px-3.5 py-3 text-body focus:border-[#6d1b52] focus:outline-none";

type Props = {
  email: string | null;
  verified: boolean;
  pending: PendingEmail | null;
  deliveryConfigured: boolean;
  disabled: boolean;
  requestAction: (email: string) => Promise<GuestResult<{ pendingEmail: PendingEmail }>>;
  cancelAction: () => Promise<GuestResult<{ cleared: boolean }>>;
};

export function EmailEditor({ email, verified, pending, deliveryConfigured, disabled, requestAction, cancelAction }: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState<"save" | "withdraw" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(kind: "save" | "withdraw") {
    setBusy(kind);
    setError(null);
    try {
      const res = kind === "save" ? await requestAction(value) : await cancelAction();
      if (!res.success) {
        setError(res.error);
        return;
      }
      setEditing(false);
      setValue("");
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const cannotVerify = deliveryConfigured
    ? "We can't send verification links from the app yet"
    : "Email isn't set up for Veloria yet, so we can't send a verification link";

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-meta text-[#6e6e73]">Email</div>
          {email ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-copy">{email}</span>
              <Pill tone={verified ? "green" : "amber"}>{verified ? "Verified" : "Not verified"}</Pill>
            </div>
          ) : (
            <div className="mt-0.5 text-copy text-[#6e6e73]">No email on file</div>
          )}
        </div>
        {!editing && !disabled && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
            className="shrink-0 text-detail font-semibold text-[#6d1b52]"
          >
            {email ? "Change" : "Add"}
          </button>
        )}
      </div>

      {email && !verified && (
        <p className="mt-1.5 text-meta leading-[1.5] text-[#6e6e73]">
          An unverified email never links bookings to this sign-in. The team can send you an activation link.
        </p>
      )}

      {pending && (
        <div className="mt-2.5 rounded-xl bg-[#fdf3e1] px-3 py-2.5 text-detail leading-[1.5] text-[#8a5a00]">
          <div>
            <span className="font-semibold">{pending.address}</span> · not verified
          </div>
          <p className="mt-1">
            {cannotVerify}, so this address can&apos;t be verified yet.{" "}
            {email ? `Your account keeps using ${email} until it is.` : "It isn't used for your bookings until it is."}
          </p>
          {!disabled && (
            <button type="button" onClick={() => run("withdraw")} disabled={busy !== null} className="mt-1.5 font-semibold text-[#6d1b52] disabled:opacity-60">
              {busy === "withdraw" ? "Withdrawing..." : "Withdraw this change"}
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="vg-rise mt-2 flex flex-col gap-2">
          <input
            className={FIELD}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={254}
            autoFocus
            aria-label="New email address"
          />
          <p className="text-meta leading-[1.5] text-[#6e6e73]">
            We save it as unverified. It doesn&apos;t change what you can see, or which bookings are linked to you, until it&apos;s verified.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => run("save")} disabled={busy !== null} className="flex-1 rounded-xl bg-[#6d1b52] py-3 text-body font-semibold text-[#fdf5f3] disabled:opacity-60">
              {busy === "save" ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Save as unverified"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy !== null} className="rounded-xl border border-black/10 px-4 py-3 text-body font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]">{error}</p>}
    </div>
  );
}
