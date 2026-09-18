"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Pill, type Tone } from "../../../../_components/ui";
import { fmtDate } from "../../../../_components/format";
import { CUSTOMER_REQUEST_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import type { GuestMenuRequestView } from "../_lib/menu-rules";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const TONE: Record<string, Tone> = { SUBMITTED: "gold", ACCEPTED: "green", DECLINED: "amber", WITHDRAWN: "grey" };

export function MenuRequestList({
  requests,
  preview,
  withdrawAction,
}: {
  requests: GuestMenuRequestView[];
  preview: boolean;
  /** withdrawMenuSelection, passed down by the page. */
  withdrawAction: (requestId: string) => Promise<Result<{ status: string }>>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function withdraw(id: string) {
    setBusy(id);
    setError(null);
    const res = await withdrawAction(id);
    setBusy(null);
    if (!res.success) return setError(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="text-copy font-semibold">Your menu requests</div>
      <div className="vg-card vg-divide mt-2.5 overflow-hidden rounded-2xl">
        {requests.map((r) => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-body font-semibold">{r.items.length} {r.items.length === 1 ? "dish" : "dishes"}</div>
                <div className="text-meta text-[#6e6e73]">Sent {fmtDate(r.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
              </div>
              <Pill tone={TONE[r.status] ?? "grey"}>{customerLabel(CUSTOMER_REQUEST_STATUS_LABEL, r.status)}</Pill>
            </div>
            {r.reviewNote && (
              <p className="mt-2 rounded-xl bg-[#f7f5f2] px-3 py-2 text-meta leading-[1.45] text-[#1d1d1f]">
                <span className="font-semibold">From the team:</span> {r.reviewNote}
              </p>
            )}
            <details className="mt-1.5">
              <summary className="cursor-pointer text-meta font-semibold text-[#6d1b52]">See dishes</summary>
              <ul className="mt-1 list-disc pl-4 text-meta leading-[1.5] text-[#6e6e73]">
                {r.items.map((i) => (
                  <li key={i.menuItemId}>
                    {i.name}
                    {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                    {i.note ? ` — “${i.note}”` : ""}
                  </li>
                ))}
              </ul>
              {r.notes && <p className="mt-1 text-meta text-[#6e6e73]">Your notes: {r.notes}</p>}
            </details>
            {r.status === "SUBMITTED" && !preview && (
              <button
                type="button"
                onClick={() => withdraw(r.id)}
                disabled={busy !== null}
                className="mt-2 inline-flex min-h-9 items-center rounded-full border border-black/[.12] bg-white px-3.5 text-meta font-semibold disabled:opacity-60"
              >
                {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : "Withdraw to change my picks"}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-1.5 text-meta text-[#b3261e]">{error}</p>}
    </div>
  );
}
