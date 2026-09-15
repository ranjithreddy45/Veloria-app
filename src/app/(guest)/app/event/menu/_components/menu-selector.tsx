"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search } from "lucide-react";
import { Chip, Pill } from "../../../../_components/ui";
import { inr } from "../../../../_components/format";
import {
  MENU_REQUEST_LIMITS,
  computeMenuPricing,
  groupByMenuCategory,
  isNonVegetarian,
  packageAllows,
  type GuestMenuDish,
  type MenuPackageRules,
  type MenuRequestItem,
} from "../_lib/menu-rules";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface MenuSelectorProps {
  bookingId: string;
  guestCount: number;
  catalog: GuestMenuDish[];
  rules: MenuPackageRules;
  preview: boolean;
  /** Where to start: the last withdrawn/declined picks, or the menu already on the booking. */
  initialItems: { menuItemId: string; note: string | null }[];
  /** submitMenuSelection, passed down by the page. */
  submitAction: (bookingId: string, input: { items: MenuRequestItem[]; notes?: string | null }) => Promise<Result<{ id: string }>>;
}

export function MenuSelector({ bookingId, guestCount, catalog, rules, preview, initialItems, submitAction }: MenuSelectorProps) {
  const router = useRouter();
  const offered = React.useMemo(() => catalog.filter((d) => packageAllows(d, rules)), [catalog, rules]);
  const byId = React.useMemo(() => new Map(offered.map((d) => [d.id, d])), [offered]);
  const [picked, setPicked] = React.useState<Map<string, string>>(
    () => new Map(initialItems.filter((i) => byId.has(i.menuItemId)).map((i) => [i.menuItemId, i.note ?? ""]))
  );
  const [query, setQuery] = React.useState("");
  const [cat, setCat] = React.useState("All");
  const [vegOnly, setVegOnly] = React.useState(rules.vegOnly);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const categories = React.useMemo(() => ["All", ...groupByMenuCategory(offered).map((g) => g.category)], [offered]);
  const q = query.trim().toLowerCase();
  const visible = offered.filter(
    (d) =>
      (cat === "All" || d.category === cat) &&
      (!vegOnly || !isNonVegetarian(d.dietaryTags)) &&
      (!q || d.name.toLowerCase().includes(q) || (d.cuisine ?? "").toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q))
  );
  const chosen = [...picked.keys()].map((id) => byId.get(id)).filter((d): d is GuestMenuDish => !!d);
  const pricing = computeMenuPricing(chosen.map((d) => ({ pricePerHead: d.pricePerHead, quantity: 1 })), guestCount);
  const full = picked.size >= MENU_REQUEST_LIMITS.maxItems;

  function toggle(id: string) {
    setError(null);
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MENU_REQUEST_LIMITS.maxItems) next.set(id, "");
      return next;
    });
  }

  async function send() {
    if (picked.size === 0 || busy) return;
    setBusy(true);
    setError(null);
    const res = await submitAction(bookingId, {
      items: [...picked.entries()].map(([menuItemId, note]) => (note.trim() ? { menuItemId, note: note.trim() } : { menuItemId })),
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (!res.success) return setError(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-copy font-semibold">Choose your dishes</div>
        <div className="numeric text-meta font-medium text-[#6e6e73]">{offered.length} on the menu</div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-black/[.08] bg-white px-3">
        <Search className="size-4 text-[#8a8a8e]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes or cuisines" aria-label="Search dishes" className="min-h-10 min-w-0 flex-1 bg-transparent text-body focus:outline-none" />
      </div>

      <div className="vg-scroll-x vg-bleed mt-2.5 gap-1.5">
        {rules.vegOnly ? (
          <Chip active>Vegetarian package</Chip>
        ) : (
          <Chip active={vegOnly} onClick={() => setVegOnly((v) => !v)}>Veg only</Chip>
        )}
        {categories.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {groupByMenuCategory(visible).map((g) => (
          <section key={g.category}>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#b88513]">{g.category}</div>
            <div className="vg-card vg-divide mt-1.5 overflow-hidden rounded-2xl">
              {g.rows.map((d) => {
                const on = picked.has(d.id);
                const tags = d.dietaryTags.filter((t) => !isNonVegetarian([t]));
                return (
                  <div key={d.id} className={`px-3.5 py-3 ${on ? "bg-[#fbf4f8]" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-body font-semibold">{d.name}</span>
                          {isNonVegetarian(d.dietaryTags) && <Pill tone="amber" className="px-2 py-0.5">Non-veg</Pill>}
                        </div>
                        {d.description && <div className="mt-0.5 line-clamp-2 text-meta leading-[1.45] text-[#6e6e73]">{d.description}</div>}
                        <div className="mt-1 text-meta text-[#8a8a8e]">
                          {[d.cuisine, ...tags].filter(Boolean).join(" · ") || (rules.vegOnly ? "Diet not marked — ask the team if unsure" : "")}
                        </div>
                        <div className="numeric mt-1 text-detail font-semibold text-[#6d1b52]">
                          {inr(d.pricePerHead)} <span className="text-meta font-medium text-[#8a8a8e]">per head</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(d.id)}
                        disabled={!on && full}
                        className={`min-h-8 shrink-0 rounded-full border-[1.5px] px-3 py-1.5 text-meta font-semibold disabled:opacity-50 ${on ? "border-[#6d1b52] bg-[#6d1b52] text-[#fdf5f3]" : "border-black/[.12] bg-white"}`}
                      >
                        {on ? <span className="inline-flex items-center gap-1">Added <Check className="size-3" strokeWidth={3} /></span> : "Add"}
                      </button>
                    </div>
                    {on && (
                      <input
                        value={picked.get(d.id) ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.slice(0, MENU_REQUEST_LIMITS.maxItemNote);
                          setPicked((prev) => new Map(prev).set(d.id, v));
                        }}
                        placeholder="Note for the kitchen (optional), e.g. less spicy"
                        aria-label={`Note for ${d.name}`}
                        className="mt-2 min-h-9 w-full rounded-[10px] border border-black/[.08] bg-white px-2.5 text-meta focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/[.12] bg-white/60 px-4 py-5 text-center text-body text-[#6e6e73]">No dishes match. Try another category or search.</p>
        )}
      </div>

      <div className="mt-4">
        <label className="text-copy font-semibold" htmlFor="menu-notes">Anything else for the team?</label>
        <textarea
          id="menu-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, MENU_REQUEST_LIMITS.maxNotes))}
          rows={3}
          placeholder="Allergies, Jain food for some guests, a dish you'd like that isn't listed…"
          className="mt-2 w-full rounded-2xl border border-black/[.08] bg-white px-3.5 py-3 text-body focus:outline-none"
        />
      </div>

      {chosen.length > 0 && (
        <p className="mt-2 text-meta leading-[1.45] text-[#6e6e73]">
          Estimate at the team&apos;s listed dish prices: {inr(pricing.pricePerHead)} per head × {pricing.guestCount.toLocaleString("en-IN")} guests (your booking) ≈ {inr(pricing.totalPrice)}.
          {rules.packageLabel ? ` Your ${rules.packageLabel} price on your quotation stays as quoted unless the team tells you otherwise.` : " The team confirms the final price before anything changes."}
        </p>
      )}
      {error && <p className="mt-2 text-meta text-[#b3261e]">{error}</p>}
      <div className="h-28" />

      <div className="vg-glass fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center gap-3 px-5 pb-[calc(var(--sab)+12px)] pt-3">
        <div className="min-w-0 flex-1">
          <div className="text-meta text-[#6e6e73]">{picked.size} {picked.size === 1 ? "dish" : "dishes"}{full ? " (the most one request can hold)" : ""}</div>
          {chosen.length > 0 && (
            <div className="numeric text-copy font-semibold text-[#6d1b52]">
              ≈ {inr(pricing.pricePerHead)} <span className="text-meta font-medium text-[#8a8a8e]">per head, estimate</span>
            </div>
          )}
        </div>
        <button type="button" onClick={send} disabled={preview || busy || picked.size === 0} className="vg-primary vg-press rounded-[14px] px-5 py-3.5 text-body font-semibold disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : preview ? "Staff preview" : "Send to the team"}
        </button>
      </div>
    </div>
  );
}
