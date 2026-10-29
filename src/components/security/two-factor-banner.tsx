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
      className="flex items-center gap-3 border-b border-amber-200/70 bg-amber-50 px-4 py-2 text-foreground dark:border-amber-500/20 dark:bg-amber-950/30 sm:px-6 lg:px-8"
    >
      <ShieldAlert className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-body">
        <span className="font-medium">
          Two-factor authentication is required for your role
        </span>
        <span className="hidden text-muted-foreground sm:inline">. Set it up to keep your account protected.</span>
      </p>
      <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2.5">
        <Link href={TWO_FACTOR_SETUP_PATH}>Set it up</Link>
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss for this session"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-amber-100 hover:text-foreground dark:hover:bg-amber-900/40"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
