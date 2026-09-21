"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  parseStoredPins,
  pinsStorageKey,
  togglePin,
  type TogglePinResult,
} from "./pins";

// ============================================================
// Personal workspace — pin store (localStorage, per user)
// ============================================================
//
// WHY localStorage AND NOT THE DATABASE: the only per-user JSON column is
// User.notificationPreferences, which is a typed ARRAY of notification toggles
// that three separate writers replace wholesale — piggy-backing UI state on it
// would be wiped by the next notification save. A dedicated column is the right
// home, but production is deployed by a script that never runs
// `prisma db push`, so shipping a schema change here would break prod. Until a
// migration is rehearsed, pins live in this browser, keyed by user id. The
// store is isolated behind this hook so swapping it for a server action later
// touches nothing else.
//
// WHY useSyncExternalStore: it gives a hydration-safe read for free. The server
// snapshot is "nothing pinned"; React re-renders with the real value right
// after hydration, so there is no mismatch warning and no effect-driven flash
// logic. It also keeps every consumer (sidebar now, dashboard shortcuts next)
// in step through one subscription.

/** `storage` = the browser refused the write (private mode, quota). Surfaced so
 *  the UI can say so instead of the star appearing to do nothing. */
export type WorkspacePinToggleResult =
  | TogglePinResult
  | { ok: false; pins: string[]; reason: "storage" };

const CHANGE_EVENT = "vg:workspace-pins-change";

function subscribe(onChange: () => void) {
  // `storage` covers other tabs; the custom event covers THIS tab, where the
  // browser deliberately does not fire `storage` for its own writes.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// Safari private mode and locked-down kiosk browsers throw on ANY storage
// access, including reads — hence the try/catch on both sides.
function readRaw(key: string | null): string {
  if (!key) return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

const noopSubscribe = () => () => {};

export function useWorkspacePins(userId: string | null | undefined) {
  const key = userId ? pinsStorageKey(userId) : null;

  // The snapshot is the raw STRING: a primitive compares by value, so the
  // store never reports a change that did not happen (returning a freshly
  // parsed array here would loop forever).
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => ""
  );
  const pins = useMemo(() => parseStoredPins(raw), [raw]);

  // false on the server and during hydration, true from the first client
  // render after it. Lets callers hold back pin UI (including the "nothing
  // pinned" hint) until the real value is known, instead of flashing it.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const toggle = useCallback(
    (href: string, allowedHrefs?: ReadonlySet<string>): WorkspacePinToggleResult => {
      // Re-read at click time rather than closing over `pins`, so two quick
      // taps (or a toggle in another tab) cannot overwrite each other.
      const current = parseStoredPins(readRaw(key));
      const result = togglePin(current, href, allowedHrefs);
      if (!result.ok) return result;
      if (!key) return { ok: false, pins: current, reason: "storage" };
      try {
        window.localStorage.setItem(key, JSON.stringify(result.pins));
      } catch {
        // Nothing to roll back — the UI reads from storage, so the star simply
        // stays as it was; the caller explains why.
        return { ok: false, pins: current, reason: "storage" };
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return result;
    },
    [key]
  );

  return { pins, hydrated, toggle };
}
