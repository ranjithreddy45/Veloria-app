"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { signOffEventReadiness, revokeEventSignOff, type SignOffState } from "@/actions/event-signoff.actions";

// The enforced human gate: an event can't go LIVE until someone signs off that
// it's ready. Shows the current state + blocking gates, and the sign-off action.
export function SignOffPanel({ bookingId, initial, canManage }: { bookingId: string; initial: SignOffState; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const s = initial;

  async function signOff() {
    setBusy(true);
    try {
      const res = await signOffEventReadiness(bookingId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Event signed off — cleared to go live.");
      router.refresh();
    } finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true);
    try {
      const res = await revokeEventSignOff(bookingId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Sign-off revoked.");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Card className={s.signedOff ? "border-emerald-200/70 dark:border-emerald-900/50" : "border-amber-200/70 dark:border-amber-900/50"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {s.signedOff ? <ShieldCheck className="size-4 text-emerald-600" /> : <ShieldAlert className="size-4 text-amber-600" />}
          Event sign-off
          {s.signedOff
            ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Cleared to go live</Badge>
            : <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Awaiting sign-off</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {s.signedOff ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Signed off{s.signedOffByName ? ` by ${s.signedOffByName}` : ""}
              {s.signedOffAt ? ` on ${new Date(s.signedOffAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.
            </p>
            {canManage && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={revoke} disabled={busy}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Revoke
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              A person must confirm this event is ready before it can go live. {s.canSignOff
                ? "All required checks pass — you're clear to sign off."
                : "Clear the blocking checks below first."}
            </p>
            {!s.canSignOff && s.blockingGates.length > 0 && (
              <ul className="space-y-1 text-sm">
                {s.blockingGates.map((g) => (
                  <li key={g} className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="size-3.5" /> {g}
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <Button onClick={signOff} disabled={busy || !s.canSignOff} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Sign off readiness
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Only Ops can sign off an event.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
