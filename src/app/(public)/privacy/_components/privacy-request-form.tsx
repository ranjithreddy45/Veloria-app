"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPrivacyRequest } from "@/actions/privacy.actions";
import {
  PRIVACY_REQUEST_KINDS,
  PRIVACY_REQUEST_KIND_LABEL,
  type PrivacyRequestKind,
} from "@/lib/privacy/policy";

// ============================================================
// Public privacy-request form (no auth). One request → one PrivacyRequest
// row + an admin notification. The server rate-limits per hashed IP.
// ============================================================

const KIND_HINT: Record<PrivacyRequestKind, string> = {
  ACCESS: "Get a copy of the personal data we hold about you.",
  DELETE: "Ask us to erase your personal data where we no longer need it.",
  CORRECT: "Fix something we hold that is wrong or out of date.",
};

export function PrivacyRequestForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [kind, setKind] = useState<PrivacyRequestKind>("ACCESS");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("Please give an email address or phone number so we can reply.");
      return;
    }
    startTransition(async () => {
      const res = await submitPrivacyRequest({
        kind,
        requesterName: name.trim(),
        requesterEmail: email.trim() || undefined,
        requesterPhone: phone.trim() || undefined,
        details: details.trim() || undefined,
        website,
      });
      if (res.success) {
        setDone(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-11 text-success" />
        <h3 className="font-editorial mt-4 text-title font-semibold text-foreground">
          Request received
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
          We will first confirm it is you (a quick reply from the email or phone number you gave),
          then respond within 30 days. If it is urgent, write to the Grievance Officer below.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-border/80 bg-card p-6 shadow-sm"
    >
      <div className="grid gap-2.5 sm:grid-cols-3">
        {PRIVACY_REQUEST_KINDS.map((k) => {
          const active = k === kind;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={active}
              className={`rounded-xl border p-3 text-left transition ${
                active
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="block text-body font-semibold text-foreground">
                {PRIVACY_REQUEST_KIND_LABEL[k]}
              </span>
              <span className="mt-1 block text-meta leading-relaxed text-muted-foreground">
                {KIND_HINT[k]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pr-name">Your name *</Label>
          <Input
            id="pr-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-email">Email</Label>
          <Input
            id="pr-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-phone">Phone</Label>
          <Input
            id="pr-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="+91 …"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pr-details">What would you like us to do?</Label>
          <Textarea
            id="pr-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Optional — e.g. which enquiry or event this is about, or what needs correcting."
          />
        </div>
        {/* Honeypot — hidden from people, filled by bots */}
        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      <p className="text-meta leading-relaxed text-muted-foreground">
        Use the email or phone number we already have for you — that is how we confirm the request
        is genuinely yours before sharing or deleting anything.
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          "Send request"
        )}
      </Button>
    </form>
  );
}
