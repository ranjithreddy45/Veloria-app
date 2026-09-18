"use client";

import * as React from "react";
import { BellOff, BellRing, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPushPublicKey } from "@/actions/push.actions";
import {
  getPermissionState,
  getPushSupport,
  isPushEnabledHere,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";

// ============================================================
// Push opt-in for the guest app: "alert me on this phone when the team
// replies". Reuses the ERP's push plumbing (push.actions, lib/push/client and
// public/sw.js): one PushSubscription table, one service worker. Each state is
// described as it is; nothing offers a switch that can't work on this device.
// ============================================================

type Known = "unsupported" | "insecure" | "not-configured" | "denied" | "on" | "off";

const COPY: Record<Known, { title: string; detail: string }> = {
  off: {
    title: "Get alerts on this phone",
    detail: "We'll alert you here when the team replies or your booking changes. You can turn this off any time.",
  },
  on: {
    title: "Alerts are on for this phone",
    detail: "Team replies and booking updates will reach you here, even with the app closed.",
  },
  denied: {
    title: "Alerts are blocked on this phone",
    detail: "Allow notifications for Veloria in your browser's site settings, then reload this page.",
  },
  unsupported: {
    title: "Alerts need the installed app",
    detail: "On iPhone, tap Share, then Add to Home Screen, and open Veloria from there to turn alerts on. Updates always appear in Notifications.",
  },
  insecure: {
    title: "Alerts need a secure connection",
    detail: "Open the app over https to turn alerts on.",
  },
  "not-configured": {
    title: "Phone alerts aren't available yet",
    detail: "Updates from the team still appear in Notifications.",
  },
};

async function detect(): Promise<Known> {
  const support = getPushSupport();
  if (support !== "supported") return support;
  const key = await getPushPublicKey();
  if (!key.success || !key.data.configured) return "not-configured";
  if (getPermissionState() === "denied") return "denied";
  return (await isPushEnabledHere()) ? "on" : "off";
}

/**
 * `compact`: a single row shown only when alerts can be turned on right now
 * (used inside the conversation). The full card also explains the other states.
 */
export function PushOptIn({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [state, setState] = React.useState<Known | "loading">("loading");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    detect().then(
      (s) => {
        if (!cancelled) setState(s);
      },
      () => {
        if (!cancelled) setState("off");
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setNote(null);
    const res = await subscribeToPush();
    setBusy(false);
    if (res.ok) {
      setState("on");
      return;
    }
    if (res.reason !== "failed") setState(res.reason);
    setNote(res.message);
  }

  async function turnOff() {
    setBusy(true);
    setNote(null);
    const res = await unsubscribeFromPush();
    setBusy(false);
    if (res.ok) setState("off");
    else setNote(res.message ?? "Couldn't turn alerts off. Please try again.");
  }

  if (state === "loading") {
    return compact ? null : <div aria-hidden className={cn("vg-card h-[74px] animate-pulse rounded-2xl", className)} />;
  }
  if (compact && state !== "off") return null;

  const copy = COPY[state];
  const Icon = state === "on" ? BellRing : state === "denied" || state === "insecure" ? ShieldAlert : state === "off" ? BellOff : Smartphone;
  const tone =
    state === "on"
      ? "bg-[#e6f6ea] text-[#2a9d4a]"
      : state === "denied" || state === "insecure"
        ? "bg-[#fdf3e1] text-[#c77700]"
        : "bg-[#f7eef2] text-[#6d1b52]";

  return (
    <div className={cn("vg-card flex items-center gap-3 rounded-2xl p-3.5", className)} data-push-state={state}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", tone)}>
        <Icon className="size-[17px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-[#1d1d1f]">{copy.title}</p>
        {!compact && <p className="mt-0.5 text-detail leading-[1.45] text-[#6e6e73]">{copy.detail}</p>}
        {note && (
          <p role="alert" className="mt-1 text-meta text-[#b3261e]">
            {note}
          </p>
        )}
      </div>
      {state === "off" && (
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="flex min-h-9 shrink-0 items-center rounded-full bg-[#6d1b52] px-3.5 text-detail font-semibold text-[#fdf5f3] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-label="Turning on" /> : "Turn on"}
        </button>
      )}
      {state === "on" && (
        <button
          type="button"
          onClick={turnOff}
          disabled={busy}
          className="flex min-h-9 shrink-0 items-center rounded-full border border-black/[.08] bg-white px-3.5 text-detail font-semibold text-[#1d1d1f] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-label="Turning off" /> : "Turn off"}
        </button>
      )}
    </div>
  );
}
