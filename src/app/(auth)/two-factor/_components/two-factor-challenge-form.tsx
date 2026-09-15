"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { completeTwoFactorChallenge } from "@/actions/two-factor.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TwoFactorChallengeForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = code.trim();
    if (!value) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    startTransition(async () => {
      const result = await completeTwoFactorChallenge(value);
      if (!result.success) {
        setCode("");
        toast.error(result.error);
        return;
      }
      // Full navigation so the refreshed session cookie is what the
      // middleware sees on the very next request.
      window.location.assign(result.data.redirectTo);
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <h2 className="text-ink-gradient large-title text-h2">
          One more step
        </h2>
        <p className="text-body text-muted-foreground">
          Enter the 6-digit code from your authenticator app
          {email ? (
            <>
              {" "}
              for <span className="font-medium text-foreground">{email}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="two-factor-code" className="text-detail font-medium text-foreground">
            Authentication code
          </Label>
          <Input
            id="two-factor-code"
            placeholder="123456"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={12}
            className="h-11 rounded-lg text-center text-lede font-semibold tracking-[0.35em]"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={isPending}
          />
          <p className="text-meta text-muted-foreground">
            Lost your phone? Enter one of your recovery codes (e.g. K7MP3-Q9XZ2)
            instead.
          </p>
        </div>

        <Button
          type="submit"
          className="button-sheen h-10 w-full rounded-lg text-body font-semibold text-primary-foreground"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify & continue"
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/sign-in" })}
        className="flex w-full items-center justify-center text-detail font-medium text-muted-foreground hover:text-foreground"
      >
        Sign out and use a different account
      </button>
    </div>
  );
}
