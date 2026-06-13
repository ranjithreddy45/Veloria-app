"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Trash2, Loader2 } from "lucide-react";
import { seedDemoProjects, clearDemoProjects } from "@/actions/projects-demo.actions";
import { Button } from "@/components/ui/button";

export function DemoControls({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) { toast.error(res.error); return; }
      toast.success(ok);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {count > 0 ? (
        <Button variant="outline" size="sm" disabled={busy === "clear"} onClick={() => run("clear", () => clearDemoProjects(), "Sample projects removed.")}>
          {busy === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Clear {count} samples
        </Button>
      ) : (
        <Button size="sm" disabled={busy === "seed"} onClick={() => run("seed", () => seedDemoProjects(), "Sample projects loaded — open any to explore.")}>
          {busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Load sample projects
        </Button>
      )}
    </div>
  );
}
