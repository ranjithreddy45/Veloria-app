"use client";

// ============================================================
// TeamSwitcher — the Wedding / Corporate / Social / Unsorted pill group a
// lead manager uses to look at one sales team's CRM. Writes ?team= to the
// URL; the server re-checks it (a rep is held to their own team whatever the
// URL says), so hiding this from reps is a courtesy, not the guard.
// ============================================================

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ViewTabs } from "@/components/ui/view-tabs";
import { SALES_TEAMS, UNSORTED } from "@/lib/crm/sales-team";

const ALL = "__all";

export function TeamSwitcher({
  value,
  counts,
  alsoSet,
}: {
  /** Current team key, UNSORTED, or null for every team. */
  value: string | null;
  /** Optional open-lead counts per team key (and UNSORTED). */
  counts?: Record<string, number>;
  /** Extra URL params to set whenever a team is picked (e.g. scope=all on /leads). */
  alsoSet?: Record<string, string | null>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const label = (text: string, key: string) =>
    counts && counts[key] !== undefined ? `${text} (${counts[key]})` : text;

  return (
    <div className="flex items-center gap-2">
      <ViewTabs
        value={value ?? ALL}
        onValueChange={(v) => {
          const params = new URLSearchParams(sp.toString());
          if (v === ALL) params.delete("team");
          else {
            params.set("team", v);
            for (const [k, val] of Object.entries(alsoSet ?? {})) {
              if (val === null) params.delete(k);
              else params.set(k, val);
            }
          }
          startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
        }}
        options={[
          { value: ALL, label: "All teams" },
          ...SALES_TEAMS.map((t) => ({ value: t.key as string, label: label(t.short, t.key) })),
          { value: UNSORTED, label: label("Unsorted", UNSORTED) },
        ]}
      />
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

/** Small read-only chip naming a team ("Wedding team"), for reps and lead rows. */
export function TeamChip({ team, className }: { team: string | null | undefined; className?: string }) {
  const t = SALES_TEAMS.find((x) => x.key === team);
  const tone =
    t?.key === "WEDDING"
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
      : t?.key === "CORPORATE"
        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : t?.key === "SOCIAL"
          ? "bg-amber-500/12 text-amber-800 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-meta font-medium ${tone} ${className ?? ""}`}
    >
      {t ? t.short : "Unsorted"}
    </span>
  );
}
