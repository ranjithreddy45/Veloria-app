import type React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Small uppercase label rendered above the title (Linear-style eyebrow). */
  eyebrow?: React.ReactNode;
  /** Right-side actions. */
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-1.5">
        {eyebrow && (
          <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[24px] font-semibold leading-none tracking-[-0.025em] text-foreground">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
