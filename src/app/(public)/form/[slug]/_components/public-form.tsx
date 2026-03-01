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

      const payload: { data: Record<string, string>; honeypot?: string } = {
        data: { ...formData },
      };

      if (honeypotValue !== undefined) {
        payload.honeypot = honeypotValue;
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
      <div className="rounded-xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Thank You!
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {thankYouMessage || "Your submission has been received. We will get back to you soon."}
        </p>
        {thankYouUrl && (
          <a
            href={thankYouUrl}
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
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
      className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      noValidate
    >
      <div className="space-y-5">
        {fields.map((field) => (
          <div key={field.name}>
            <label
              htmlFor={field.name}
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {field.label}
              {field.required && (
                <span className="ml-0.5 text-red-500">*</span>
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
                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-zinc-800 dark:text-zinc-100 ${
                  errors[field.name]
                    ? "border-red-300 focus:border-red-500 dark:border-red-700"
                    : "border-zinc-300 focus:border-indigo-500 dark:border-zinc-700"
                }`}
              />
            ) : field.type === "SELECT" ? (
              <select
                id={field.name}
                name={field.name}
                required={field.required}
                value={formData[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-zinc-800 dark:text-zinc-100 ${
                  errors[field.name]
                    ? "border-red-300 focus:border-red-500 dark:border-red-700"
                    : "border-zinc-300 focus:border-indigo-500 dark:border-zinc-700"
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
                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-zinc-800 dark:text-zinc-100 ${
                  errors[field.name]
                    ? "border-red-300 focus:border-red-500 dark:border-red-700"
                    : "border-zinc-300 focus:border-indigo-500 dark:border-zinc-700"
                }`}
              />
            )}

            {errors[field.name] && (
              <p className="mt-1 text-xs text-red-500">{errors[field.name]}</p>
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
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
