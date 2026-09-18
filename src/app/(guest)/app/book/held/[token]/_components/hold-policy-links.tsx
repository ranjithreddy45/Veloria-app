import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAppHoldTerms } from "@/actions/public-hold.actions";
import { policyPath } from "@/lib/public/policies";
import { HOLD_TERMS_NOTICE } from "@/lib/holds/hold-terms";

// ============================================================
// Server component: the policies that apply to a hold, linked to their public
// pages — the same published documents the reserve flow asked the customer to
// accept. With no published cancellation and refund policy, the honest notice
// is shown instead of a link to nothing.
// ============================================================

export async function HoldPolicyLinks() {
  const docs = await getAppHoldTerms();
  const hasCancellation = docs.some((d) => d.key === "CANCELLATION_REFUND");
  if (docs.length === 0 && !hasCancellation) {
    return (
      <p className="w-full rounded-2xl border border-dashed border-black/[.12] bg-white/60 px-4 py-3 text-left text-detail leading-[1.5] text-[#3a3a3c]">
        {HOLD_TERMS_NOTICE}
      </p>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 text-left">
      {docs.map((d) => (
        <Link
          key={d.key}
          href={policyPath(d.key)}
          className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-black/[.08] bg-white px-4 py-3 text-body font-semibold text-[#1d1d1f]"
        >
          <span className="min-w-0 flex-1">{d.title}</span>
          <ChevronRight className="size-4 text-[#c7c7cc]" aria-hidden />
        </Link>
      ))}
      {!hasCancellation && (
        <p className="rounded-2xl border border-dashed border-black/[.12] bg-white/60 px-4 py-3 text-detail leading-[1.5] text-[#3a3a3c]">
          {HOLD_TERMS_NOTICE}
        </p>
      )}
    </div>
  );
}
