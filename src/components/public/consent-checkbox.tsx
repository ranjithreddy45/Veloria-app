"use client";

import * as React from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CONSENT_TEXT_ENQUIRY, PRIVACY_POLICY_PATH } from "@/lib/privacy/consent-text";

// ============================================================
// Consent checkbox — the ONE consent control used on every public form.
// ------------------------------------------------------------
// `text` must be the exact sentence the server records (see
// src/lib/privacy/consent-text.ts): the trailing "— see Privacy Policy" is
// rendered as a link so the reader can open the policy before ticking.
// ============================================================

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Full consent sentence, ending in "— see Privacy Policy". */
  text?: string;
  id?: string;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

const POLICY_SUFFIX = "— see Privacy Policy";

export function ConsentCheckbox({
  checked,
  onCheckedChange,
  text = CONSENT_TEXT_ENQUIRY,
  id = "privacy-consent",
  error,
  disabled,
  className,
}: ConsentCheckboxProps) {
  const hasSuffix = text.endsWith(POLICY_SUFFIX);
  const lead = hasSuffix ? text.slice(0, -POLICY_SUFFIX.length) : text;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-2.5 text-detail leading-relaxed text-muted-foreground"
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <span>
          {lead}
          {hasSuffix ? (
            <>
              —{" "}
              <Link
                href={PRIVACY_POLICY_PATH}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                see Privacy Policy
              </Link>
            </>
          ) : null}
        </span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="text-meta text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
