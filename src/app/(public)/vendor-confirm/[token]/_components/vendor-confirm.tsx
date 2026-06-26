"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitVendorResponse } from "@/actions/public-vendor-confirm.actions";

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

  function submit(response: "CONFIRM" | "DECLINE") {
    startTransition(async () => {
      const res = await submitVendorResponse(token, response, note || undefined);
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
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        onClick={() => submit("CONFIRM")}
        disabled={pending}
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
  );
}
