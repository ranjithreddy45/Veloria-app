"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptVenueOwnerInvite } from "@/actions/venue-owner.actions";
import { OWNER_PASSWORD_MIN, ownerPasswordError } from "@/lib/venue-owner/admin-rules";

export function VenueOwnerActivateForm({
  userId,
  token,
  email,
  signInHref,
}: {
  userId: string;
  token: string;
  email: string;
  signInHref: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = ownerPasswordError(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await acceptVenueOwnerInvite({ userId, token, password, confirm });
      if (res.success) {
        setDone(true);
        toast.success("Your login is ready.");
      } else {
        setError(res.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[22px] border border-success/20 bg-success/10 p-6 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-copy font-semibold text-success">Login activated</p>
        <p className="text-detail text-success/80">
          Sign in with <strong className="break-all">{email}</strong> and your new password.
        </p>
        <Button asChild className="mt-2 w-full bg-success hover:bg-success/90">
          <Link href={signInHref}>Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface-glass space-y-4 rounded-[22px] p-5 sm:p-6">
      <div className="space-y-1.5">
        <Label htmlFor="owner-email" className="text-body">
          Your sign-in email
        </Label>
        <Input id="owner-email" value={email} readOnly disabled className="bg-muted/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner-password" className="text-body">
          Create a password
        </Label>
        <Input
          id="owner-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${OWNER_PASSWORD_MIN} characters`}
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner-password-confirm" className="text-body">
          Confirm password
        </Label>
        <Input
          id="owner-password-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
          disabled={pending}
        />
      </div>
      {error && (
        <p role="alert" className="text-detail text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Activate my login
      </Button>
    </form>
  );
}
