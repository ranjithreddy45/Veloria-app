// ============================================================
// Shared-element morph between pages ("the lead's name flows from the
// list row up into the lead page header").
// ------------------------------------------------------------
// A View Transition would freeze the whole screen until the next page
// arrives, and these pages wait on the database. So this is a FLIP instead:
// on click we remember where each [data-morph] element in the clicked row
// was; when the next page renders an element with the same id (MorphIn) it
// starts at that spot and size and glides into place. Nothing waits on it,
// and a stale or missing snapshot simply means no morph.
// ============================================================

export interface MorphSnapshot {
  left: number;
  top: number;
  fontSize: number;
  at: number;
}

/** A snapshot older than this belongs to a navigation the user has moved on from. */
const FRESH_MS = 2500;

const pending = new Map<string, MorphSnapshot>();

/** Remember every [data-morph] element in the row/card the click came from. */
export function captureMorphs(target: Element) {
  const scope = target.closest("[data-morph-scope], tr, li") ?? target.closest("[data-morph]");
  if (!scope) return;
  const els = scope.matches("[data-morph]")
    ? [scope]
    : Array.from(scope.querySelectorAll<HTMLElement>("[data-morph]"));
  const at = performance.now();
  for (const el of els) {
    const id = el.getAttribute("data-morph");
    if (!id) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    pending.set(id, {
      left: r.left,
      top: r.top,
      fontSize: parseFloat(getComputedStyle(el).fontSize) || 16,
      at,
    });
  }
}

/** The snapshot for `id`, used at most once. */
export function takeMorph(id: string): MorphSnapshot | null {
  const snap = pending.get(id);
  pending.delete(id);
  if (!snap || performance.now() - snap.at > FRESH_MS) return null;
  return snap;
}
