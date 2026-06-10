"use client";

import * as React from "react";
import { HelpCircleIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ============================================================
// HelpHint — a small "?" icon next to a page title that opens a
// short, plain-English explainer popover. Used to coach the team
// on what each CRM module is for.
// ============================================================

export interface HelpHintProps {
  /** Bold heading inside the popover. */
  title: string;
  /** The explainer body — string or rich content. */
  children: React.ReactNode;
  /** Accessible label for the trigger button. */
  label?: string;
  className?: string;
}

export function HelpHint({ title, children, label, className }: HelpHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? `What is ${title}?`}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <HelpCircleIcon className="size-4" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 text-[13px] leading-relaxed"
      >
        <p className="mb-1.5 text-[13.5px] font-semibold text-foreground">
          {title}
        </p>
        <div className="space-y-2 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
