"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-transition";
import { compareHref } from "../app/venues/_lib/links";

// A guest's shortlist lives on their device (localStorage) so it works before
// they have an account. It is a convenience, not a record: nothing here is
// sent to the server.
const KEY = "vg-shortlist";
const EVT = "vg-shortlist";

function read(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
function write(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); window.dispatchEvent(new Event(EVT)); } catch { /* storage unavailable */ }
}

export function useShortlist() {
  const [ids, setIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const toggle = React.useCallback((id: string) => {
    const next = read().includes(id) ? read().filter((x) => x !== id) : [...read(), id];
    write(next); setIds(next);
    return next.includes(id);
  }, []);
  return { ids, toggle, has: (id: string) => ids.includes(id) };
}

export function SaveButton({ venueId, className }: { venueId: string; className?: string }) {
  const { has, toggle } = useShortlist();
  const [note, setNote] = React.useState<string | null>(null);
  const saved = has(venueId);
  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Remove from shortlist" : "Save to shortlist"}
        onClick={() => { const on = toggle(venueId); setNote(on ? "Saved to your shortlist" : "Removed from saved"); window.setTimeout(() => setNote(null), 2000); }}
        className={cn("flex size-10 items-center justify-center rounded-full bg-white/[.92] backdrop-blur", className)}
      >
        <Heart className="size-5 text-[#6d1b52]" fill={saved ? "#6d1b52" : "none"} strokeWidth={1.8} />
      </button>
      {note && (
        <div className="vg-rise fixed inset-x-5 top-[calc(var(--sat)+0.75rem)] z-40 mx-auto flex max-w-md items-center gap-2.5 rounded-[14px] bg-[#1d1d1f]/[.92] px-4 py-3 text-detail font-medium text-white backdrop-blur">
          <span className="size-2 rounded-full bg-[#e8b631]" />{note}
        </div>
      )}
    </>
  );
}

/** Small heart badge on a hall card when it is on the shortlist. */
export function SavedMark({ venueId, className }: { venueId: string; className?: string }) {
  const { has } = useShortlist();
  if (!has(venueId)) return null;
  return <span className={cn("flex size-7 items-center justify-center rounded-full bg-[#fdf5f3]/[.92]", className)}><Heart className="size-3.5 text-[#6d1b52]" fill="#6d1b52" /></span>;
}

export function ShortlistCount() {
  const { ids } = useShortlist();
  return <>{ids.length === 0 ? "None yet" : `${ids.length} saved`}</>;
}

/** "Compare saved halls" — appears once two or more halls are on this device's shortlist (the first three are compared). */
export function CompareSavedLink({ className }: { className?: string }) {
  const { ids } = useShortlist();
  if (ids.length < 2) return null;
  return (
    <NavLink
      href={compareHref(ids.slice(0, 3))}
      kind="push"
      className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#6d1b52]/25 bg-[#f7eef2] px-3.5 py-2 text-detail font-semibold text-[#6d1b52]", className)}
    >
      <Heart className="size-3.5" fill="#6d1b52" aria-hidden /> Compare saved halls
    </NavLink>
  );
}
