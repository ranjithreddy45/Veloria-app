"use client";

import { useEffect } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";

// ============================================================
// Recover pages that outlive a deploy.
//
// Every build issues new server-action IDs. A tab opened before a deploy keeps
// calling the old IDs, and the server answers "Failed to find Server Action":
// saves and background refreshes silently do nothing, and a sign-in form on
// such a page can never succeed however many times the password is typed.
// (Production logged 1,746 of these in half an hour on 15 Sep.)
//
// A reload fetches the current build, so that is the whole fix. It is rate-
// limited per tab so a genuine server fault can't turn into a reload loop, and
// it is skipped entirely when session storage is unavailable for the same reason.
// ============================================================

const RELOAD_AT = "vg-stale-build-reload-at";
const NOTE_AT = "vg-stale-build-note-at";
const MIN_GAP_MS = 30_000;

/** Reload onto the current build. Returns false when a reload happened moments ago (or can't be guarded). */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_AT) || 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    window.sessionStorage.setItem(RELOAD_AT, String(Date.now()));
    window.sessionStorage.setItem(NOTE_AT, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** True once, right after a stale-build reload — lets a form explain why it is empty again. */
export function consumeStaleBuildNote(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(NOTE_AT) || 0);
    window.sessionStorage.removeItem(NOTE_AT);
    return at > 0 && Date.now() - at < 60_000;
  } catch {
    return false;
  }
}

/** Mounted once in the root layout: catches stale action calls nobody awaited with a try/catch. */
export function StaleBuildRecovery() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (unstable_isUnrecognizedActionError(e.reason) && reloadForNewBuild()) e.preventDefault();
    };
    const onError = (e: ErrorEvent) => {
      if (unstable_isUnrecognizedActionError(e.error) && reloadForNewBuild()) e.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
