"use client";

import { useState, useCallback } from "react";
import { Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicReferral } from "@/actions/public-referral.actions";

// ============================================================
// PUBLIC referral intake form — client component (no internal data)
// ------------------------------------------------------------
// Captures the prospect's details + a hidden honeypot and calls the no-auth
// submitPublicReferral action. Renders only a success/thank-you state; no ids,
// amounts, or partner internals are ever rendered.
// ============================================================

interface ReferralIntakeFormProps {
  code: string;
  utm: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

export function ReferralIntakeForm({ code, utm }: ReferralIntakeFormProps) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    prospectName: "",
    prospectPhone: "",
    prospectEmail: "",
    eventType: "",
    eventDate: "",
    guestCount: "",
    message: "",
    website: "", // honeypot
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!form.prospectName.trim()) {
        setError("Please enter a name.");
        return;
      }
      if (!form.prospectPhone.trim() && !form.prospectEmail.trim()) {
        setError("Please add a phone number or email so we can reach out.");
        return;
      }

      setLoading(true);
      try {
        const res = await submitPublicReferral(code, {
          prospectName: form.prospectName,
          prospectPhone: form.prospectPhone || undefined,
          prospectEmail: form.prospectEmail || undefined,
          eventType: form.eventType || undefined,
          eventDate: form.eventDate || undefined,
          guestCount: form.guestCount ? Number(form.guestCount) : undefined,
          message: form.message || undefined,
          website: form.website || undefined,
          utmSource: utm.utmSource,
          utmMedium: utm.utmMedium,
          utmCampaign: utm.utmCampaign,
        });
        if (!res.success) {
          setError(res.error || "Something went wrong. Please try again.");
          return;
        }
        setDone(true);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [code, form, utm],
  );

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
          Thank you — our team will reach out
        </p>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          We’ve received your details and a Veloria Grand event consultant will
          be in touch shortly to help plan your celebration.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Honeypot — visually hidden, never shown to real users. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={set("website")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prospectName">Your name *</Label>
        <Input
          id="prospectName"
          value={form.prospectName}
          onChange={set("prospectName")}
          maxLength={200}
          required
          placeholder="e.g. Priya Sharma"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="prospectPhone">Phone</Label>
          <Input
            id="prospectPhone"
            type="tel"
            value={form.prospectPhone}
            onChange={set("prospectPhone")}
            maxLength={30}
            placeholder="+91 98XXXXXXXX"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prospectEmail">Email</Label>
          <Input
            id="prospectEmail"
            type="email"
            value={form.prospectEmail}
            onChange={set("prospectEmail")}
            maxLength={200}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="eventType">Event type</Label>
          <Input
            id="eventType"
            value={form.eventType}
            onChange={set("eventType")}
            maxLength={100}
            placeholder="Wedding, Reception…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eventDate">Preferred date</Label>
          <Input
            id="eventDate"
            type="date"
            value={form.eventDate}
            onChange={set("eventDate")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="guestCount">Approx. guest count</Label>
        <Input
          id="guestCount"
          type="number"
          min={1}
          max={100000}
          value={form.guestCount}
          onChange={set("guestCount")}
          placeholder="e.g. 350"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Anything else?</Label>
        <Textarea
          id="message"
          value={form.message}
          onChange={set("message")}
          maxLength={2000}
          rows={4}
          placeholder="Tell us about your event…"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-rose-600">
          <AlertCircle className="size-4" /> {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="mr-2 size-4" /> Submit referral
          </>
        )}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        By submitting, you agree that Veloria Grand may contact you about your
        event. We never share your details.
      </p>
    </form>
  );
}
