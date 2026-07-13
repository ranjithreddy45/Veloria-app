"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { submitVendorResponse } from "@/actions/public-vendor-confirm.actions";
import { VENDOR_TERMS, VENDOR_TERMS_VERSION } from "@/lib/legal/vendor-terms";

// ============================================================
// PUBLIC client — token-scoped Confirm / Decline controls. The respondToken is
// the only credential; the flip is idempotent server-side. A Decline opens a
// small optional-note field before submitting.
// ============================================================

export function VendorConfirm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "declining">("idle");
  const [note, setNote] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  function submit(response: "CONFIRM" | "DECLINE") {
    startTransition(async () => {
      const res = await submitVendorResponse(
        token,
        response,
        note || undefined,
        response === "CONFIRM" ? termsAccepted : undefined
      );
      if (res.success) {
        toast.success(
          res.data.status === "CONFIRMED"
            ? "Confirmed — thank you!"
            : "Noted — we've recorded that you can't make it."
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (mode === "declining") {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Can&apos;t make it?
          </p>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X className="size-4" />
          </button>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Optional — let us know why (helps us reassign)."
          className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />

        <Button
          onClick={() => submit("DECLINE")}
          disabled={pending}
          className="w-full bg-rose-600 hover:bg-rose-700"
        >
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Confirm decline
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Terms & Conditions — must be acknowledged before confirming */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setTermsOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left"
          aria-expanded={termsOpen}
        >
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Terms &amp; Conditions
            <span className="ml-2 text-xs font-normal text-zinc-400">
              v{VENDOR_TERMS_VERSION}
            </span>
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-zinc-400 transition-transform ${
              termsOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          className={`overflow-y-auto border-t border-zinc-100 px-5 dark:border-zinc-800 ${
            termsOpen ? "max-h-72 py-4" : "max-h-40 py-4"
          }`}
        >
          <div className="space-y-4">
            {VENDOR_TERMS.map((section) => (
              <div key={section.heading}>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  {section.heading}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {section.points.map((point, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300"
                    >
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-zinc-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={(v) => setTermsAccepted(v === true)}
          disabled={pending}
          className="mt-0.5"
        />
        <span className="text-sm text-zinc-700 dark:text-zinc-200">
          I have read and accept the Terms &amp; Conditions.
        </span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => submit("CONFIRM")}
          disabled={pending || !termsAccepted}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          {pending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Check className="mr-2 size-4" />
          )}
          Confirm
        </Button>
        <Button
          variant="outline"
          onClick={() => setMode("declining")}
          disabled={pending}
          className="flex-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
        >
          Can&apos;t make it
        </Button>
      </div>
    </div>
  );
}
