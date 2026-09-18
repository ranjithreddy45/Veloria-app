"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Chip, Pill } from "../../../_components/ui";
import { inr } from "../../../_components/format";
import type { PublicCateringPackage, PublicPackage, PublicPackageGroup } from "../_lib/package-catalog";
import {
  estimateCatering,
  estimatePackage,
  estimateSelection,
  packageRequestText,
  priceBasis,
  priceUnitLabel,
  quantityLabel,
  type EstimateLine,
} from "../_lib/package-pricing";

type RequestResult = { success: true; data: { id: string } } | { success: false; error: string };

export interface PackagePickerProps {
  catering: PublicCateringPackage[];
  groups: PublicPackageGroup[];
  hallName: string | null;
  initialGuests: number | null;
  booking: { id: string } | null;
  signedIn: boolean;
  preview: boolean;
  /** The booking is one this login was invited to: only its own customer may request packages. */
  hostOnly: boolean;
  signInHref: string;
  /** requestFromConcierge, passed down by the page (kind "PACKAGES"). */
  requestAction: (bookingId: string, text: string, kind: "PACKAGES") => Promise<RequestResult>;
}

const CATERING = "__catering";
const MAX_GUESTS = 10_000;

/** "≈ ₹1,44,000 for 120 plates" — or nothing when the estimate would just repeat a flat price. */
function estimateText(line: EstimateLine | null, priceUnit: string): string | null {
  if (!line) return null;
  if (line.basis === "ONE" && priceBasis(priceUnit) === "FLAT") return null;
  const tail = line.basis === "MINIMUM" ? " (the minimum)" : line.basis === "ONE" ? " — the team confirms how many" : "";
  return `≈ ${inr(line.amount)} for ${line.qtyLabel}${tail}`;
}

function Toggle({ on, onClick, labels }: { on: boolean; onClick: () => void; labels: [string, string] }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-8 shrink-0 rounded-full border-[1.5px] px-3 py-1.5 text-meta font-semibold ${on ? "border-[#6d1b52] bg-[#6d1b52] text-[#fdf5f3]" : "border-black/[.12] bg-white"}`}
    >
      {on ? <span className="inline-flex items-center gap-1">{labels[1]} <Check className="size-3" strokeWidth={3} /></span> : labels[0]}
    </button>
  );
}

export function PackagePicker(props: PackagePickerProps) {
  const { catering, groups, hallName, booking, signedIn, preview, signInHref, requestAction } = props;
  const router = useRouter();
  const [filter, setFilter] = React.useState("all");
  const [guests, setGuests] = React.useState(props.initialGuests && props.initialGuests > 0 ? String(props.initialGuests) : "");
  const [cateringId, setCateringId] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set());
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const guestCount = Math.min(MAX_GUESTS, Math.max(0, Math.floor(Number(guests) || 0)));
  const all = React.useMemo(() => groups.flatMap((g) => g.packages), [groups]);
  const chosen = all.filter((p) => picked.has(p.id));
  const chosenCatering = catering.find((c) => c.id === cateringId) ?? null;
  const count = chosen.length + (chosenCatering ? 1 : 0);
  const estimate = estimateSelection({ guests: guestCount, cateringId, packages: chosen });

  const chips = [
    { key: "all", label: "All" },
    ...(catering.length ? [{ key: CATERING, label: "Veloria catering" }] : []),
    ...groups.map((g) => ({ key: g.key, label: g.label })),
  ];
  const show = (key: string) => filter === "all" || filter === key;

  function togglePackage(id: string) {
    setNote(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function request() {
    if (!booking || count === 0) return;
    setBusy(true);
    setNote(null);
    const text = packageRequestText({ catering: chosenCatering, packages: chosen, estimate });
    const res = await requestAction(booking.id, text, "PACKAGES");
    setBusy(false);
    if (!res.success) return setNote(res.error);
    router.push(`/app/event?${new URLSearchParams({ b: booking.id, requested: "1" }).toString()}`);
  }

  return (
    <>
      <div className="vg-card rounded-2xl px-4 py-3.5">
        <label className="flex items-center justify-between gap-3">
          <span className="text-body font-semibold">Estimate for</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_GUESTS}
              value={guests}
              onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
              placeholder="0"
              aria-label="Number of guests"
              className="numeric h-10 w-20 rounded-[10px] border border-black/[.12] bg-white px-2.5 text-right text-body focus:outline-none"
            />
            <span className="text-body text-[#6e6e73]">guests</span>
          </span>
        </label>
        <p className="mt-2 text-meta leading-[1.45] text-[#6e6e73]">
          Estimates use the team&apos;s quotation calculator and are before taxes. Your quotation has the final price.
          {hallName ? ` Showing what's offered at ${hallName}.` : ""}
        </p>
      </div>

      {chips.length > 2 && (
        <div className="vg-scroll-x vg-bleed gap-1.5">
          {chips.map((c) => (
            <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>{c.label}</Chip>
          ))}
        </div>
      )}

      {show(CATERING) && catering.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-copy font-semibold">Veloria catering</h2>
            <span className="text-meta text-[#6e6e73]">per plate · one per booking</span>
          </div>
          <div className="vg-card vg-divide mt-2.5 overflow-hidden rounded-2xl">
            {catering.map((c) => {
              const on = cateringId === c.id;
              const est = estimateText(estimateCatering(c.id, guestCount), "PER_PLATE");
              return (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${on ? "bg-[#fbf4f8]" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-semibold">{c.label}</span>
                      <Pill tone={c.veg ? "green" : "amber"} className="px-2 py-0.5">{c.veg ? "Veg" : "Non-veg"}</Pill>
                    </div>
                    <div className="numeric mt-0.5 text-detail font-semibold text-[#6d1b52]">
                      {inr(c.perPlate)} <span className="text-meta font-medium text-[#636368]">per plate</span>
                    </div>
                    {est && <div className="numeric mt-0.5 text-meta text-[#6e6e73]">{est}</div>}
                  </div>
                  <Toggle on={on} onClick={() => { setNote(null); setCateringId(on ? null : c.id); }} labels={["Choose", "Chosen"]} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {groups.filter((g) => show(g.key)).map((g) => (
        <section key={g.key}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-copy font-semibold">{g.label}</h2>
            <span className="text-meta text-[#6e6e73]">{g.packages.length} {g.packages.length === 1 ? "package" : "packages"}</span>
          </div>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {g.packages.map((p) => (
              <PackageCard key={p.id} pkg={p} on={picked.has(p.id)} guests={guestCount} onToggle={() => togglePackage(p.id)} />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/[.12] bg-white/60 px-4 py-5 text-center text-body text-[#6e6e73]">
          {hallName ? `No partner packages are published for ${hallName} yet.` : "Partner packages will be listed here once the team publishes them."}
        </p>
      )}

      {props.hostOnly && (
        <p className="text-meta leading-[1.45] text-[#6e6e73]">You were invited to this booking, so you can browse. Only the booking&apos;s host can request packages for it.</p>
      )}
      {note && <p className="text-meta text-[#b3261e]">{note}</p>}
      <div className="h-28" />

      <div className="vg-glass vg-col vg-gutter fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 pb-[calc(var(--sab)+12px)] pt-3">
        <div className="min-w-0 flex-1">
          <div className="text-meta text-[#6e6e73]">{count} selected</div>
          {estimate ? (
            <div className="numeric text-copy font-semibold text-[#6d1b52]">
              ≈ {inr(estimate.subtotal)} <span className="text-meta font-medium text-[#636368]">before taxes</span>
            </div>
          ) : (
            <div className="text-meta text-[#6e6e73]">{count > 0 ? "Add a guest count for an estimate" : "Prices shown on each package"}</div>
          )}
        </div>
        {!signedIn ? (
          <Link href={signInHref} className="vg-primary vg-press rounded-[14px] px-5 py-3.5 text-body font-semibold">Sign in to request</Link>
        ) : !booking ? (
          <Link href="/app/book" className="vg-primary vg-press rounded-[14px] px-5 py-3.5 text-body font-semibold">Hold a date first</Link>
        ) : props.hostOnly ? (
          <button type="button" disabled className="vg-primary rounded-[14px] px-5 py-3.5 text-body font-semibold opacity-60">Host requests only</button>
        ) : preview ? (
          <button type="button" disabled className="vg-primary rounded-[14px] px-5 py-3.5 text-body font-semibold opacity-60">Staff preview</button>
        ) : (
          <button type="button" onClick={request} disabled={busy || count === 0} className="vg-primary vg-press rounded-[14px] px-5 py-3.5 text-body font-semibold disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Request for my booking"}
          </button>
        )}
      </div>
    </>
  );
}

function PackageCard({ pkg: p, on, guests, onToggle }: { pkg: PublicPackage; on: boolean; guests: number; onToggle: () => void }) {
  const est = estimateText(estimatePackage(p, guests), p.priceUnit);
  const img = p.imageUrl ? p.imageUrl.replace(/["\\]/g, "\\$&") : null;
  return (
    <div className={`overflow-hidden rounded-[18px] border-[1.5px] bg-white ${on ? "border-[#6d1b52]" : "border-black/[.06]"}`}>
      <div className="flex gap-3 p-3">
        <div
          aria-hidden
          className="flex size-[84px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#f7eef2] to-[#efdbe7] bg-cover bg-center font-editorial text-[30px] font-semibold text-[#6d1b52]/45"
          style={img ? { backgroundImage: `url("${img}")` } : undefined}
        >
          {img ? null : (p.categoryLabel.charAt(0) || "V")}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#b88513]">{p.categoryLabel}</div>
          <div className="mt-0.5 text-body font-semibold">{p.name}</div>
          <div className="mt-0.5 line-clamp-2 text-meta leading-[1.45] text-[#6e6e73]">{p.vendorName}{p.description ? ` · ${p.description}` : ""}</div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
            <div className="min-w-0">
              <div className="numeric text-detail font-semibold text-[#6d1b52]">
                {inr(p.unitPrice)} <span className="text-meta font-medium text-[#636368]">{priceUnitLabel(p.priceUnit)}</span>
              </div>
              {p.minPax != null && p.minPax > 1 && <div className="text-meta text-[#636368]">Minimum {quantityLabel(p.priceUnit, p.minPax)}</div>}
            </div>
            <Toggle on={on} onClick={onToggle} labels={["Add", "Added"]} />
          </div>
          {est && <div className="numeric mt-1 text-meta text-[#6e6e73]">{est}</div>}
        </div>
      </div>
      {p.inclusions.length > 0 && (
        <details className="border-t border-black/[.06] px-3 py-2">
          <summary className="cursor-pointer text-meta font-semibold text-[#6d1b52]">What&apos;s included</summary>
          <div className="mt-1.5 flex flex-col gap-1.5 pb-1">
            {p.inclusions.map((s, i) => (
              <div key={`${s.title}-${i}`}>
                <div className="text-meta font-semibold">{s.title}</div>
                <ul className="mt-0.5 list-disc pl-4 text-meta leading-[1.45] text-[#6e6e73]">
                  {s.items.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
