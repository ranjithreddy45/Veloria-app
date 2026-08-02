import { cn } from "@/lib/utils";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_HUE } from "@/lib/hr/constants";
import type { EmployeeStatus } from "@prisma/client";

const HUE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

export function EmployeeStatusPill({ status }: { status: EmployeeStatus }) {
  const hue = EMPLOYEE_STATUS_HUE[status] ?? "slate";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-meta font-medium",
        HUE[hue]
      )}
    >
      {EMPLOYEE_STATUS_LABELS[status] ?? status}
    </span>
  );
}
