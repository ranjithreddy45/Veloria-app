"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { requestLoginOtp } from "@/actions/otp.actions";
import type { PublicContact } from "@/lib/public/business-contact";
import { ContactLinks } from "@/app/(guest)/_components/contact-links";

// Passwordless WhatsApp sign-in — the same "otp" provider the staff sign-in
// uses, so the phone number on a booking, date hold or enquiry is the whole
// credential. Who can get a code is decided on the server (src/lib/otp.ts);
// this screen never learns whether a number is on our records, so the "code
// sent" wording stays conditional.

type Notice = { text: string; contactUs?: boolean };

const HELP_MESSAGE = "Hi, I need help signing in to the Veloria Grand app.";

// Codes thrown by the "otp" provider (OTP_SIGNIN_ERROR in src/lib/otp.ts). All
// but otp_rate_limited arrive only after a valid code, so explaining them
// reveals nothing to someone who doesn't hold the phone.
function verifyNotice(code: string | undefined): Notice {
  switch (code) {
    case "otp_shared_number":
      return {
        text: "This number is on more than one record with us, so we can't tell which booking is yours. Message or call us and we'll link it for you.",
        contactUs: true,
      };
    case "otp_login_disabled":
      return { text: "Sign-in for this number has been switched off. Please contact us.", contactUs: true };
    case "otp_no_record":
      return { text: "We can't find a booking or enquiry on this number any more. Please contact us.", contactUs: true };
    case "otp_rate_limited":
      return { text: "Too many attempts. Wait a few minutes, then try again." };
    case "otp_try_again":
      return { text: "Something went wrong while signing you in. Ask for a new code and try again." };
    default:
      return { text: "That code didn't match or has expired. Check the newest WhatsApp message, or ask for a new code." };
  }
}

function formatWait(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The venue's WhatsApp / Call buttons, or an honest line when none are published. */
function ContactUs({ contact, className }: { contact: PublicContact; className?: string }) {
  if (!contact.whatsapp && !contact.phone) {
    return (
      <p className={className}>
        If you&rsquo;ve been in touch with our team before, reach them the way you did then.
      </p>
    );
  }
  return (
    <div className={className}>
      <ContactLinks contact={contact} context={HELP_MESSAGE} />
      {contact.supportHours && <p className="mt-1.5 text-meta text-[#fdf5f3]/60">{contact.supportHours}</p>}
    </div>
  );
}

export function OtpSignIn({ next, contact }: { next: string; contact: PublicContact }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [sentNote, setSentNote] = React.useState("");
  const [resendIn, setResendIn] = React.useState(0);

  // Count down the gap before another code can be sent (the server enforces it too).
  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    if (phone.replace(/\D/g, "").length < 10) {
      setNotice({ text: "Enter the mobile number you gave us, with the country code if it isn't Indian." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await requestLoginOtp(phone);
      if (!res.success) {
        setNotice({ text: res.error, contactUs: res.reason === "WHATSAPP_UNAVAILABLE" });
        return;
      }
      setSentNote(res.message);
      setResendIn(res.resendInSeconds);
      setCode("");
      setStep("code");
    } catch {
      setNotice({ text: "We couldn't reach Veloria Grand. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setNotice({ text: "Enter the 6-digit code from WhatsApp." });
      return;
    }
    setBusy(true);
    setNotice(null);
    let leaving = false;
    try {
      const res = await signIn("otp", { phone, code, redirect: false });
      if (res && !res.error) {
        leaving = true;
        // Full page load, so every screen reads the new session straight away.
        window.location.assign(next);
        return;
      }
      setNotice(verifyNotice(res?.code));
    } catch {
      setNotice({ text: "Sign-in didn't go through. Please try again." });
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  const field =
    "w-full rounded-2xl border border-[#fdf5f3]/25 bg-[#fdf5f3]/10 px-4 py-3.5 text-copy text-[#fdf5f3] placeholder:text-[#fdf5f3]/45 focus:border-[#e8b631] focus:outline-none";
  const primary =
    "vg-press rounded-2xl bg-[#fdf5f3] py-[17px] text-copy font-semibold text-[#6d1b52] disabled:opacity-60";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primary}>
        Continue with phone number
      </button>
    );
  }

  return (
    <div className="vg-rise flex flex-col gap-2.5">
      {step === "phone" ? (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <label htmlFor="vg-signin-phone" className="text-detail leading-[1.5] text-[#fdf5f3]/80">
            Use the mobile number you gave us for your booking, date hold or enquiry. We&rsquo;ll send a 6-digit code to
            it on WhatsApp.
          </label>
          <input
            id="vg-signin-phone"
            className={field}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={busy} className={primary}>
            {busy ? <Loader2 className="mx-auto size-5 animate-spin" aria-label="Sending" /> : "Send code on WhatsApp"}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <p role="status" className="text-detail leading-[1.5] text-[#fdf5f3]/80">
            {sentNote}
          </p>
          <p className="text-meta text-[#fdf5f3]/60">Number: {phone}</p>
          <label htmlFor="vg-signin-code" className="sr-only">
            6-digit code
          </label>
          <input
            id="vg-signin-code"
            className={`${field} tracking-[.3em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          <button type="submit" disabled={busy} className={primary}>
            {busy ? <Loader2 className="mx-auto size-5 animate-spin" aria-label="Checking" /> : "Continue"}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-detail">
            <button
              type="button"
              className="py-1 text-[#fdf5f3]/70"
              onClick={() => {
                setStep("phone");
                setCode("");
                setNotice(null);
              }}
            >
              Use a different number
            </button>
            <button
              type="button"
              className="py-1 font-semibold text-[#f3d489] disabled:font-normal disabled:text-[#fdf5f3]/45"
              disabled={busy || resendIn > 0}
              onClick={() => void sendCode()}
            >
              {resendIn > 0 ? `New code in ${formatWait(resendIn)}` : "Send a new code"}
            </button>
          </div>
          <details className="rounded-2xl border border-[#fdf5f3]/15 bg-[#fdf5f3]/[.06] px-4 py-3 text-detail leading-[1.5] text-[#fdf5f3]/80">
            <summary className="cursor-pointer font-semibold text-[#fdf5f3]">Didn&rsquo;t get a code?</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>
                We only send codes to numbers on a booking, date hold or enquiry with us, or to numbers a host has invited
                to their event.
              </li>
              <li>The code comes on WhatsApp, so the number needs WhatsApp.</li>
              <li>Each code works for 5 minutes, and only the newest one works.</li>
            </ul>
            <p className="mt-3 font-semibold text-[#fdf5f3]">Still stuck?</p>
            <ContactUs contact={contact} className="mt-2" />
          </details>
        </form>
      )}
      {notice && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-[#ff3b30]/15 px-3 py-2 text-detail text-[#ffb4ae]">
          <p>{notice.text}</p>
          {notice.contactUs && <ContactUs contact={contact} />}
        </div>
      )}
      <p className="text-meta text-[#fdf5f3]/55">
        New here? Browse as a guest. Once you send an enquiry or hold a date, you can sign in with the same number.
      </p>
    </div>
  );
}
