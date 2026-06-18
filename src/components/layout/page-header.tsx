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
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  children,
  help,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-[32px]">
            {title}
          </h1>
          {help}
        </div>
        {description && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
