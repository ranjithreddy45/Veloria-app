"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { requestLoginOtp } from "@/actions/otp.actions";

// Passwordless WhatsApp OTP — the same provider the staff sign-in uses, so a
// host's phone number is the whole credential. Nothing here stores a password.
export function OtpSignIn({ next }: { next: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function sendCode() {
    if (phone.replace(/\D/g, "").length < 10) return setError("Enter a valid mobile number.");
    setBusy(true); setError(null);
    try {
      const res = await requestLoginOtp(phone);
      if (!res.success) return setError(res.error || "Couldn't send the code.");
      setStep("code");
    } finally { setBusy(false); }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setBusy(true); setError(null);
    try {
      const res = await signIn("otp", { phone, code, redirect: false, callbackUrl: next });
      if (!res || res.error) return setError("That code didn't match or has expired.");
      router.push(next);
      router.refresh();
    } finally { setBusy(false); }
  }

  const field = "w-full rounded-2xl border border-[#fdf5f3]/25 bg-[#fdf5f3]/10 px-4 py-3.5 text-copy text-[#fdf5f3] placeholder:text-[#fdf5f3]/45 focus:border-[#e8b631] focus:outline-none";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="vg-press rounded-2xl bg-[#fdf5f3] py-[17px] text-copy font-semibold text-[#6d1b52]">
        Continue with phone number
      </button>
    );
  }

  return (
    <div className="vg-rise flex flex-col gap-2.5">
      {step === "phone" ? (
        <>
          <input className={field} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
          <button type="button" onClick={sendCode} disabled={busy} className="vg-press rounded-2xl bg-[#fdf5f3] py-[17px] text-copy font-semibold text-[#6d1b52] disabled:opacity-60">
            {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "Send code on WhatsApp"}
          </button>
        </>
      ) : (
        <>
          <p className="text-detail text-[#fdf5f3]/75">A 6-digit code is on its way to {phone} on WhatsApp.</p>
          <input className={`${field} tracking-[.3em]`} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
          <button type="button" onClick={verify} disabled={busy} className="vg-press rounded-2xl bg-[#fdf5f3] py-[17px] text-copy font-semibold text-[#6d1b52] disabled:opacity-60">
            {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "Continue"}
          </button>
          <button type="button" onClick={() => { setStep("phone"); setCode(""); }} className="text-detail text-[#fdf5f3]/70">Use a different number</button>
        </>
      )}
      {error && <p className="rounded-xl bg-[#ff3b30]/15 px-3 py-2 text-detail text-[#ffb4ae]">{error}</p>}
      <p className="text-meta text-[#fdf5f3]/55">Only numbers on an existing booking can sign in. New here? Browse as a guest and hold a date — we create your account when you do.</p>
    </div>
  );
}
