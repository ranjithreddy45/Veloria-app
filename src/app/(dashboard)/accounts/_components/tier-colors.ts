// Tier badge color map for the corporate farming module. Kept local to the
// module (not in shared constants) so this feature is fully additive.

export const CORPORATE_TIER_COLORS: Record<string, string> = {
  PROSPECT: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300",
  ACTIVE: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300",
  KEY: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300",
  DORMANT: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300",
  CHURNED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300",
};
