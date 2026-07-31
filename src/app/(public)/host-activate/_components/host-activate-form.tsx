"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptHostInvite } from "@/actions/host-portal-invite.actions";

export function HostActivateForm({ contactId, token, email }: { contactId: string; token: string; email: string }) {
  const [pending, startTransition] = React.useTransition();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [done, setDone] = React.useState(false);

  function submit() {
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords don't match."); return; }
    startTransition(async () => {
      const res = await acceptHostInvite({ contactId, token, password });
      if (res.success) { setDone(true); toast.success("Your event portal is ready."); }
      else toast.error(res.error);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/20 bg-success/10 p-6 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-sm font-semibold text-success">Portal activated</p>
        <p className="text-xs text-success/80">
          Sign in with <strong>{email}</strong> and your new password.
        </p>
        <Button asChild className="mt-2 w-full bg-success hover:bg-success/90">
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="space-y-1.5">
        <Label className="text-sm">Your sign-in email</Label>
        <Input value={email} readOnly disabled className="bg-muted/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hp" className="text-sm">Create a password</Label>
        <Input id="hp" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" disabled={pending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hpc" className="text-sm">Confirm password</Label>
        <Input id="hpc" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" disabled={pending} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
      <Button onClick={submit} disabled={pending} className="w-full gap-2 bg-primary hover:bg-primary/90">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Activate my portal
      </Button>
    </div>
  );
}
