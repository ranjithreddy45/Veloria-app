"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { requestFromConcierge, type GuestPackage } from "@/actions/guest-host.actions";
import { Chip } from "../../../_components/ui";
import { inr } from "../../../_components/format";

function unitLabel(u: string) {
  const s = u.toLowerCase().replace(/_/g, " ");
  return s.startsWith("per ") ? `/ ${s.slice(4)}` : s === "flat" || s === "fixed" ? "" : `/ ${s}`;
}

export function PackagePicker({ packages, bookingId }: { packages: GuestPackage[]; bookingId: string | null }) {
  const router = useRouter();
  const cats = React.useMemo(() => ["All", ...Array.from(new Set(packages.map((p) => p.category)))], [packages]);
  const [cat, setCat] = React.useState("All");
  const [picked, setPicked] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const chosen = packages.filter((p) => picked[p.id]);
  const total = chosen.reduce((a, p) => a + p.price, 0);

  async function request() {
    if (!bookingId) return setNote("Hold a date first — packages attach to a booking.");
    if (chosen.length === 0) return;
    setBusy(true);
    const text = `Please add to my booking: ${chosen.map((p) => `${p.name} (${p.vendorName}, ${inr(p.price)}${unitLabel(p.priceUnit) ? " " + unitLabel(p.priceUnit) : ""})`).join("; ")}.`;
    const res = await requestFromConcierge(bookingId, text, "PACKAGES");
    setBusy(false);
    if (!res.success) return setNote(res.error);
    router.push("/app/event?requested=1");
  }

  return (
    <>
      {cats.length > 2 && (
        <div className="vg-scroll-x vg-bleed gap-1.5">{cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      )}
      <div className="flex flex-col gap-2.5">
        {packages.filter((p) => cat === "All" || p.category === cat).map((p) => {
          const on = !!picked[p.id];
          return (
            <div key={p.id} className={`overflow-hidden rounded-[18px] border-[1.5px] bg-white ${on ? "border-[#6d1b52]" : "border-black/[.06]"}`}>
              <div className="flex gap-3 p-3">
                <div aria-hidden className="size-[84px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#f7eef2] to-[#efdbe7] bg-cover bg-center" style={p.imageUrl ? { backgroundImage: `url("${p.imageUrl.replace(/["\\]/g, "\\$&")}")` } : undefined} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#b88513]">{p.category}</div>
                  <div className="mt-0.5 text-body font-semibold">{p.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-meta leading-[1.45] text-[#6e6e73]">{p.vendorName}{p.description ? ` · ${p.description}` : ""}</div>
                  <div className="mt-auto flex items-center justify-between pt-1.5">
                    <div className="numeric text-detail font-semibold text-[#6d1b52]">{inr(p.price)} <span className="text-meta font-medium text-[#8a8a8e]">{unitLabel(p.priceUnit)}</span></div>
                    <button type="button" onClick={() => setPicked((x) => ({ ...x, [p.id]: !x[p.id] }))} className={`min-h-8 rounded-full border-[1.5px] px-3 py-1.5 text-meta font-semibold ${on ? "border-[#6d1b52] bg-[#6d1b52] text-[#fdf5f3]" : "border-black/[.12] bg-white"}`}>{on ? "Added ✓" : "Add"}</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {note && <p className="text-meta text-[#6e6e73]">{note}</p>}
      <div className="h-24" />
      <div className="vg-glass fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center gap-3 px-5 pb-[calc(var(--sab)+12px)] pt-3">
        <div className="min-w-0 flex-1"><div className="text-meta text-[#6e6e73]">{chosen.length} selected</div><div className="numeric text-copy font-semibold text-[#6d1b52]">{inr(total)}</div></div>
        <button type="button" onClick={request} disabled={busy || chosen.length === 0} className="vg-primary vg-press rounded-[14px] px-5 py-3.5 text-body font-semibold">{busy ? <Loader2 className="size-4 animate-spin" /> : "Request for my booking"}</button>
      </div>
    </>
  );
}
