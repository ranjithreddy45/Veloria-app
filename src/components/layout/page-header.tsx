import type React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Small uppercase label rendered above the title (Linear-style eyebrow). */
  eyebrow?: React.ReactNode;
  /** Right-side actions. */
  children?: React.ReactNode;
  /** Optional help hint rendered as a "?" next to the title. */
  help?: React.ReactNode;
  /** Render a premium ambient aura + dotted grid behind the header.
   * Use on module landing pages for a hero moment. */
  aura?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  children,
  help,
  aura = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between",
        aura &&
          "bg-aura bg-grid-faint -mx-4 -mt-4 rounded-3xl px-4 pb-5 pt-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow && (
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
            <span aria-hidden className="h-3 w-[3px] rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
            <span className="text-brand-gradient">{eyebrow}</span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="large-title text-[28px] leading-tight text-foreground sm:text-[32px]">
            {title}
          </h1>
          {help}
        </div>
        {description && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="relative flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
