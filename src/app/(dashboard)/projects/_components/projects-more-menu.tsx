"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FlaskConical as FlaskConicalIcon, Loader2 as Loader2Icon, Trash2 as Trash2Icon } from "lucide-react";

import { seedDemoProjects, clearDemoProjects } from "@/actions/projects-demo.actions";
import { PageMoreMenuTrigger } from "@/components/ui/quick-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// ProjectsMoreMenu: the "More actions" menu in the /projects header.
// ------------------------------------------------------------
// /projects has no create action (a project is created from a BD deal), so
// its cluster is this menu alone. It holds the admin-only sample-data tool,
// which is maintenance, not a page action (design spec R6):
//
// - Load sample projects, while none are loaded: seeds the demo portfolio.
// - Clear N samples, while some are loaded: removes them again.
//
// The page renders it for SUPER_ADMIN / ADMIN only, and the server actions
// re-check that themselves. The same actions, toasts and refresh as the
// header buttons it replaces.
// ============================================================

interface ProjectsMoreMenuProps {
  /** How many sample projects are loaded. 0 offers Load; more offers Clear. */
  count: number;
}

export function ProjectsMoreMenu({ count }: ProjectsMoreMenuProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"seed" | "clear" | null>(null);

  async function run(
    key: "seed" | "clear",
    fn: () => Promise<{ success: boolean; error?: string }>,
    ok: string
  ) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PageMoreMenuTrigger aria-busy={busy !== null || undefined} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {count > 0 ? (
          <DropdownMenuItem
            disabled={busy === "clear"}
            onSelect={() => void run("clear", () => clearDemoProjects(), "Sample projects removed.")}
          >
            {busy === "clear" ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            Clear {count} samples
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={busy === "seed"}
            onSelect={() => void run("seed", () => seedDemoProjects(), "Sample projects loaded — open any to explore.")}
          >
            {busy === "seed" ? <Loader2Icon className="animate-spin" /> : <FlaskConicalIcon />}
            Load sample projects
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
