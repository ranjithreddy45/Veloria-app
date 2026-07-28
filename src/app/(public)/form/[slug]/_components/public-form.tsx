"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { WebformField } from "@/schemas/webform.schema";

// ============================================================
// Public Form Component
// ============================================================

interface PublicFormProps {
  slug: string;
  fields: WebformField[];
  honeypotField?: string;
  thankYouMessage?: string;
  thankYouUrl?: string;
}

// ============================================================
// Embed bridge — attribution capture + parent postMessage
// ------------------------------------------------------------
// The smart embed snippet (see generateEmbedCode) forwards the PARENT
// page's click ids / utm params onto THIS page's query string, so we can
// simply read our own location. Standalone (un-embedded) usage still
// works: we fall back to our own href / document.referrer.
//
// Contract with the parent page:
//   child -> parent  { type: 'veloria:resize', height: <px> }
//   child -> parent  { type: 'veloria:lead:submitted', slug: <slug> }
// The parent verifies event.origin === <app origin> before acting.
// ============================================================

const ATTRIBUTION_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/**
 * Read attribution off our own query string. Shaped as the nested
 * `attribution` object that `parseAttributionFromRequest` accepts.
 * Never throws — attribution must never block a submission.
 */
function collectAttribution(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    if (typeof window === "undefined") return out;
    const params = new URLSearchParams(window.location.search);

    for (const key of ATTRIBUTION_PARAMS) {
      const value = params.get(key)?.trim();
      if (value) out[key] = value.slice(0, 255);
    }

    // landing_url: the PARENT page URL when embedded, else our own URL.
    const landing = params.get("landing_url")?.trim() || window.location.href;
    if (landing) {
      out.landingUrl = landing.slice(0, 2048);
      out.landing_url = out.landingUrl;
    }

    // referrer: forwarded parent referrer when embedded, else our own.
    const referrer = params.get("referrer")?.trim() || document.referrer;
    if (referrer) out.referrer = referrer.slice(0, 2048);
  } catch {
    // ignore — best effort only
  }
  return out;
}

/** True when this page is rendered inside an iframe. */
function isEmbedded(): boolean {
  try {
    return typeof window !== "undefined" && window.parent !== window;
  } catch {
    return false;
  }
}

/** Best-effort postMessage to the embedding parent. Never throws. */
function postToParent(message: Record<string, unknown>): void {
  try {
    if (!isEmbedded()) return;
    window.parent.postMessage(message, "*");
  } catch {
    // ignore — standalone page or blocked frame
  }
}

export function PublicForm({
  slug,
  fields,
  honeypotField,
  thankYouMessage,
  thankYouUrl,
}: PublicFormProps) {
  const [formData, setFormData] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Capture attribution once on mount (query string is stable for the page).
  const attributionRef = React.useRef<Record<string, string>>({});
  React.useEffect(() => {
    attributionRef.current = collectAttribution();
  }, []);

  // Keep the embedding iframe sized to our content (no inner scrollbar).
  React.useEffect(() => {
    if (!isEmbedded()) return;

    let last = 0;
    const report = () => {
      try {
        const height = Math.ceil(
          Math.max(
            document.body?.scrollHeight ?? 0,
            document.documentElement?.scrollHeight ?? 0
          )
        );
        if (!height || Math.abs(height - last) < 2) return;
        last = height;
        postToParent({ type: "veloria:resize", height });
      } catch {
        // ignore
      }
    };

    report();
    const raf = window.requestAnimationFrame(report);
    window.addEventListener("resize", report);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && document.body) {
      observer = new ResizeObserver(report);
      observer.observe(document.body);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", report);
      observer?.disconnect();
    };
  }, [isSubmitted]);

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      const value = formData[field.name]?.trim() || "";

      if (field.required && !value) {
        newErrors[field.name] = `${field.label} is required`;
        continue;
      }

      if (value && field.type === "EMAIL") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.name] = "Please enter a valid email address";
        }
      }

      if (value && field.type === "PHONE") {
        const phoneRegex = /^[+]?[\d\s\-().]{7,20}$/;
        if (!phoneRegex.test(value)) {
          newErrors[field.name] = "Please enter a valid phone number";
        }
      }

      if (value && field.type === "NUMBER") {
        if (isNaN(Number(value))) {
          newErrors[field.name] = "Please enter a valid number";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // Build submission payload
      const honeypotValue =
        honeypotField && (e.target as HTMLFormElement).elements.namedItem(
          `__hp_${honeypotField}`
        )
          ? ((e.target as HTMLFormElement).elements.namedItem(
              `__hp_${honeypotField}`
            ) as HTMLInputElement)?.value || ""
          : undefined;

      const payload: {
        data: Record<string, string>;
        honeypot?: string;
        attribution?: Record<string, string>;
      } = {
        data: { ...formData },
      };

      if (honeypotValue !== undefined) {
        payload.honeypot = honeypotValue;
      }

      // Nested `attribution` — the shape parseAttributionFromRequest reads.
      const attribution = Object.keys(attributionRef.current).length
        ? attributionRef.current
        : collectAttribution();
      if (Object.keys(attribution).length) {
        payload.attribution = attribution;
      }

      const response = await fetch(`/api/webforms/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setSubmitError(result.error || "Something went wrong. Please try again.");
        return;
      }

      // Tell the embedding page a lead was captured BEFORE any redirect, so
      // the parent can fire its Google Ads conversion while we're still alive.
      postToParent({ type: "veloria:lead:submitted", slug });

      // Handle redirect
      if (result.data?.redirectUrl) {
        window.location.href = result.data.redirectUrl;
        return;
      }

      setIsSubmitted(true);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h2 className="mt-4 text-xl font-bold text-foreground">
          Thank You!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {thankYouMessage || "Your submission has been received. We will get back to you soon."}
        </p>
        {thankYouUrl && (
          <a
            href={thankYouUrl}
            className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80"
          >
            Continue
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      noValidate
    >
      <div className="space-y-5">
        {fields.map((field) => (
          <div key={field.name}>
            <label
              htmlFor={field.name}
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              {field.label}
              {field.required && (
                <span className="ml-0.5 text-destructive">*</span>
              )}
            </label>

            {field.type === "TEXTAREA" ? (
              <textarea
                id={field.name}
                name={field.name}
                placeholder={field.placeholder || ""}
                required={field.required}
                value={formData[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                rows={4}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-zinc-800 dark:text-zinc-100 ${
                  errors[field.name]
                    ? "border-destructive/20 focus:border-destructive"
                    : "border-border focus:border-primary"
                }`}
              />
            ) : field.type === "SELECT" ? (
              <select
                id={field.name}
                name={field.name}
                required={field.required}
                value={formData[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-zinc-800 dark:text-zinc-100 ${
                  errors[field.name]
                    ? "border-destructive/20 focus:border-destructive"
                    : "border-border focus:border-primary"
                }`}
              >
                <option value="">
                  {field.placeholder || `Select ${field.label}`}
                </option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={field.name}
                name={field.name}
                type={
                  field.type === "EMAIL"
                    ? "email"
                    : field.type === "PHONE"
                      ? "tel"
                      : field.type === "NUMBER"
                        ? "number"
                        : field.type === "DATE"
                          ? "date"
                          : "text"
                }
                placeholder={field.placeholder || ""}
                required={field.required}
                value={formData[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-zinc-800 dark:text-zinc-100 ${
                  errors[field.name]
                    ? "border-destructive/20 focus:border-destructive"
                    : "border-border focus:border-primary"
                }`}
              />
            )}

            {errors[field.name] && (
              <p className="mt-1 text-xs text-destructive">{errors[field.name]}</p>
            )}
          </div>
        ))}

        {/* Honeypot field — hidden from humans */}
        {honeypotField && (
          <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
            <input
              type="text"
              name={`__hp_${honeypotField}`}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
        )}
      </div>

      {/* Error message */}
      {submitError && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 flex w-full items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit"
        )}
      </button>
    </form>
  );
}
