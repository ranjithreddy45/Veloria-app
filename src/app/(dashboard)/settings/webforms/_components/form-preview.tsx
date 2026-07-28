"use client";

import type { WebformField } from "@/schemas/webform.schema";

// ============================================================
// Form Preview Component
// ============================================================

interface FormPreviewProps {
  fields: WebformField[];
}

export function FormPreview({ fields }: FormPreviewProps) {
  if (!fields || fields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">
          No fields to preview. Add fields to see a live preview.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="space-y-5">
        {fields.map((field, index) => (
          <div key={index}>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              {field.label || "Untitled Field"}
              {field.required && (
                <span className="ml-0.5 text-destructive">*</span>
              )}
            </label>

            {field.type === "TEXTAREA" ? (
              <textarea
                placeholder={field.placeholder || ""}
                rows={4}
                disabled
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
            ) : field.type === "SELECT" ? (
              <select
                disabled
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
              >
                <option>
                  {field.placeholder || `Select ${field.label || "option"}`}
                </option>
                {field.options?.map((option, i) => (
                  <option key={i}>{option}</option>
                ))}
              </select>
            ) : (
              <input
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
                disabled
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
            )}
          </div>
        ))}
      </div>

      {/* Submit button preview */}
      <button
        type="button"
        disabled
        className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white opacity-75 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Submit
      </button>
    </div>
  );
}
