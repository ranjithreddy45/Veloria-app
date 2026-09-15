"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TWO_FACTOR_SETUP_PATH } from "@/lib/security/two-factor-policy";

const DISMISS_KEY = "vg:2fa-banner-dismissed";

// sessionStorage read via useSyncExternalStore: the server snapshot says
// "dismissed" so nothing flashes during hydration, then the client snapshot
// takes over. Private mode / blocked storage falls back to "not dismissed".
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
function serverDismissed() {
  return true;
}

/**
 * "Two-factor authentication is required for your role" strip. Dismissable
 * for the rest of the browser session; hidden on the setup page itself.
 */
export function TwoFactorBanner() {
  const pathname = usePathname();
  const storedDismissed = useSyncExternalStore(subscribe, readDismissed, serverDismissed);
  const [dismissedNow, setDismissedNow] = useState(false);

  if (storedDismissed || dismissedNow) return null;
  if (pathname === TWO_FACTOR_SETUP_PATH || pathname === "/settings/security") {
    return null;
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode / blocked storage — just hide for this render tree.
    }
    setDismissedNow(true);
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 sm:px-6 lg:px-8"
    >
      <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="min-w-0 flex-1 text-detail">
        <span className="font-medium">
          Two-factor authentication is required for your role
        </span>
        <span className="hidden sm:inline"> — set it up now to keep your account protected.</span>
      </p>
      <Button
        asChild
        size="sm"
        className="h-7 shrink-0 rounded-md bg-amber-600 px-2.5 text-meta font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
      >
        <Link href={TWO_FACTOR_SETUP_PATH}>Set it up now</Link>
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss for this session"
        className="shrink-0 rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
