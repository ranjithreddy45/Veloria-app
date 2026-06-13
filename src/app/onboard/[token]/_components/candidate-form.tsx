"use client";

import * as React from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { submitCandidateDetails } from "@/actions/hr-journey.actions";

export function CandidateForm({
  token, firstName, phone, personalEmail,
}: {
  token: string; firstName: string; phone: string | null; personalEmail: string | null;
}) {
  const [ph, setPh] = React.useState(phone ?? "");
  const [email, setEmail] = React.useState(personalEmail ?? "");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setError(null); setBusy(true);
    const res = await submitCandidateDetails(token, { phone: ph, personalEmail: email });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold">Thank you, {firstName}!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your details are confirmed. Our HR team will be in touch with your joining instructions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[12.5px] font-medium">Mobile number</label>
        <input value={ph} onChange={(e) => setPh(e.target.value)} placeholder="+91 ..."
          className="h-10 w-full rounded-lg border bg-background px-3 text-[14px] outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[12.5px] font-medium">Personal email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
          className="h-10 w-full rounded-lg border bg-background px-3 text-[14px] outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={busy}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[14px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />} Confirm my details
      </button>
      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Your information is encrypted and shared only with HR.
      </p>
    </div>
  );
}
