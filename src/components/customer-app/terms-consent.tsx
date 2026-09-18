"use client";

import * as React from "react";
import { ChevronDown, ExternalLink, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOLD_TERMS_NOTICE, holdTermsLabel } from "@/lib/holds/hold-terms";

// ============================================================
// TermsConsent — the customer reads the PUBLISHED policies and ticks one box.
// Reusable wherever a customer must accept terms before acting (the reserve
// flow today). The server page loads the documents and their page links
// (policyPath) and passes them in; this component fetches nothing and imports
// nothing server-only. The checkbox sentence comes from holdTermsLabel(), the
// same function the server uses to build the text it records, so what is
// ticked is exactly what is stored.
//
// With no published cancellation and refund policy it shows the honest notice
// instead of terms. It never renders policy text as HTML.
// ============================================================

export interface TermsConsentPolicy {
  key: string;
  title: string;
  body: string;
  version: number;
  publishedAt?: string | null;
  /** The policy's public page (policyPath(key)), built on the server. */
  href?: string | null;
}

function publishedOn(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export function TermsConsent({
  policies,
  checked,
  onCheckedChange,
  error,
  notice = HOLD_TERMS_NOTICE,
  label,
  heading = "Before you hold",
  className,
}: {
  /** Published policies only, in display order. Empty when none are published. */
  policies: readonly TermsConsentPolicy[];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string | null;
  /** Shown when no cancellation and refund policy is published. */
  notice?: string;
  /** Checkbox sentence. Defaults to holdTermsLabel(policies). */
  label?: string;
  heading?: string;
  className?: string;
}) {
  const id = React.useId();
  const sentence =
    label ?? holdTermsLabel(policies.map((p) => ({ key: p.key as "CANCELLATION_REFUND" | "BOOKING_TERMS", title: p.title })));
  const showNotice = !policies.some((p) => p.key === "CANCELLATION_REFUND");

  return (
    <section aria-labelledby={`${id}-heading`} className={cn("flex flex-col gap-2.5", className)}>
      <div id={`${id}-heading`} className="text-detail font-semibold">{heading}</div>

      {policies.map((p, i) => {
        const on = publishedOn(p.publishedAt);
        return (
          <details key={p.key} open={i === 0} className="vg-card group overflow-hidden rounded-2xl">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <ScrollText className="size-4 shrink-0 text-[#6d1b52]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold">{p.title}</span>
                <span className="block text-meta text-[#6e6e73]">Version {p.version}{on ? ` · published ${on}` : ""}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-[#8a8a8e] transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="max-h-60 overflow-y-auto whitespace-pre-wrap border-t border-black/[.06] px-4 py-3 text-detail leading-[1.6] text-[#3a3a3c]">
              {p.body}
            </div>
            {p.href && (
              // New tab, so leaving to read the full page never loses the booking in progress.
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 border-t border-black/[.06] px-4 py-2.5 text-detail font-semibold text-[#6d1b52]"
              >
                Open the full policy page <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </details>
        );
      })}

      {showNotice && (
        <p className="rounded-2xl border border-dashed border-black/[.12] bg-white/60 px-4 py-3 text-detail leading-[1.5] text-[#3a3a3c]">
          {notice}
        </p>
      )}

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border bg-white px-4 py-3",
          error ? "border-[#b3261e]/50" : "border-black/[.08]"
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-[#6d1b52]"
        />
        <span className="text-detail leading-[1.5] text-[#1d1d1f]">{sentence}</span>
      </label>

      {error && (
        <p id={`${id}-error`} role="alert" className="rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]">
          {error}
        </p>
      )}
    </section>
  );
}
