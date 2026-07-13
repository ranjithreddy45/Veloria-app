"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { submitGuestConfirmation } from "@/actions/guest-confirm.actions";

// ============================================================
// PUBLIC client — guest declaration form. The token is the only credential and
// the acceptance flip is idempotent server-side. Requires both a typed name and
// the T&C checkbox before it can submit; on success it swaps to a local success
// state (no router needed on a public page).
// ============================================================

const dueFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function fmtDue(d: string | Date | null): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return `${dueFmt.format(date)} (IST)`;
}

export function GuestConfirmForm({
  token,
  dueAt,
}: {
  token: string;
  dueAt: string | Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [confirmedName, setConfirmedName] = useState<string | null>(null);

  const due = fmtDue(dueAt);
  const canSubmit = name.trim().length > 0 && accepted && !pending;

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await submitGuestConfirmation(token, {
        name: name.trim(),
        accepted: true,
      });
      if (res.success) {
        setConfirmedName(name.trim());
        toast.success(
          res.data.already
            ? "This event was already confirmed — thank you!"
            : "Confirmed — thank you!",
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  if (confirmedName) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <CheckCircle2 className="size-8 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Thank you, {confirmedName}!
        </p>
        <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
          Your event services and Terms &amp; Conditions are confirmed. Our team
          will be in touch with the final details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Confirmation &amp; declaration
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Please review your event services above, then confirm below.
        </p>
      </div>

      {due && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Clock className="size-3.5 shrink-0" />
          Please confirm by {due}.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="guest-name" className="text-sm">
          Your full name
        </Label>
        <Input
          id="guest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your full name"
          maxLength={120}
          autoComplete="name"
          disabled={pending}
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
          disabled={pending}
          className="mt-0.5"
        />
        <Label
          htmlFor="accept-terms"
          className="text-sm font-normal leading-relaxed text-zinc-700 dark:text-zinc-300"
        >
          I have reviewed my event services and accept the Terms &amp; Conditions.
        </Label>
      </div>

      <Button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {pending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 size-4" />
        )}
        Confirm my event
      </Button>
    </div>
  );
}
