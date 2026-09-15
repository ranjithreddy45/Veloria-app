"use client";

// ============================================================
// PushToggle — "Enable notifications on this device" switch.
//
// Self-contained: works out support / permission / server config on mount and
// renders honest copy for every state. Drop it anywhere a signed-in user can
// see it (`compact` for the notification popover row; default for settings
// pages and the guest app).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getPushPublicKey } from "@/actions/push.actions";
import {
  getPermissionState,
  getPushSupport,
  isPushEnabledHere,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";

type ToggleState =
  | "loading"
  | "unsupported"
  | "insecure"
  | "not-configured"
  | "denied"
  | "on"
  | "off";

const COPY: Record<ToggleState, { title: string; detail: string }> = {
  loading: {
    title: "Checking this device…",
    detail: "",
  },
  unsupported: {
    title: "Push isn't available in this browser",
    detail:
      "On iPhone, add Veloria to your Home Screen first, then enable it from there.",
  },
  insecure: {
    title: "Push needs a secure connection",
    detail: "Open the app over https to enable device notifications.",
  },
  "not-configured": {
    title: "Push isn't set up on the server yet",
    detail: "Ask an admin to add the VAPID keys. In-app notifications still work.",
  },
  denied: {
    title: "Notifications are blocked for this site",
    detail: "Allow them in your browser's site settings, then reload this page.",
  },
  on: {
    title: "Notifications on for this device",
    detail: "You'll get alerts here even when the app is closed.",
  },
  off: {
    title: "Enable notifications on this device",
    detail: "Get alerts here even when the app is closed.",
  },
};

interface PushToggleProps {
  /** Single dense row (used at the top of the notification popover). */
  compact?: boolean;
  className?: string;
}

export function PushToggle({ compact = false, className }: PushToggleProps) {
  const [state, setState] = useState<ToggleState>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const support = getPushSupport();
    if (support !== "supported") {
      setState(support);
      return;
    }
    const key = await getPushPublicKey();
    if (!key.success || !key.data.configured) {
      setState("not-configured");
      return;
    }
    if (getPermissionState() === "denied") {
      setState("denied");
      return;
    }
    setState((await isPushEnabledHere()) ? "on" : "off");
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh().catch(() => {
      if (!cancelled) setState("off");
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setBusy(true);
      try {
        if (checked) {
          const res = await subscribeToPush();
          if (res.ok) {
            setState("on");
            toast.success("Notifications enabled on this device");
          } else {
            if (res.reason === "denied") setState("denied");
            if (res.reason === "not-configured") setState("not-configured");
            toast.error(res.message);
          }
        } else {
          const res = await unsubscribeFromPush();
          if (res.ok) {
            setState("off");
            toast.success("Notifications turned off on this device");
          } else {
            toast.error(res.message ?? "Couldn't turn off notifications");
          }
        }
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const interactive = state === "on" || state === "off";
  const copy = COPY[state];

  const Icon =
    state === "loading"
      ? Loader2
      : state === "on"
        ? BellRing
        : state === "denied" || state === "insecure"
          ? ShieldAlert
          : state === "unsupported" || state === "not-configured"
            ? Smartphone
            : BellOff;

  const iconTone =
    state === "on"
      ? "bg-success/10 text-success"
      : state === "denied" || state === "insecure"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        compact ? "border-b bg-muted/30 px-4 py-2.5" : "rounded-lg border bg-card p-4",
        className
      )}
      data-push-state={state}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full",
          compact ? "size-7" : "size-9",
          iconTone
        )}
        aria-hidden
      >
        <Icon
          className={cn(compact ? "size-3.5" : "size-4", state === "loading" && "animate-spin")}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "leading-tight text-foreground",
            compact ? "text-detail font-medium" : "text-body font-medium"
          )}
        >
          {copy.title}
        </p>
        {copy.detail && (
          <p
            className={cn(
              "mt-0.5 text-muted-foreground",
              compact ? "text-meta line-clamp-1" : "text-detail"
            )}
          >
            {copy.detail}
          </p>
        )}
      </div>

      <Switch
        size={compact ? "sm" : "default"}
        checked={state === "on"}
        disabled={!interactive || busy}
        onCheckedChange={handleToggle}
        aria-label={
          state === "on"
            ? "Turn off notifications on this device"
            : "Enable notifications on this device"
        }
      />
    </div>
  );
}
