"use client";

// ============================================================
// StressToggle — flips the cash-flow forecast into "collections slip" mode by
// pushing ?stress=1 into the URL (the server action re-derives accordingly).
// ============================================================

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { CloudRain } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function StressToggle({ stress }: { stress: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  function onToggle(next: boolean) {
    const url = next ? `${pathname}?stress=1` : pathname;
    startTransition(() => router.push(url, { scroll: false }));
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-1.5 shadow-card">
      <CloudRain
        className={
          stress ? "size-4 text-rose-500" : "size-4 text-muted-foreground"
        }
      />
      <span className="text-xs font-medium">Stress test</span>
      <Switch
        checked={stress}
        onCheckedChange={onToggle}
        disabled={pending}
        aria-label="Stress test — slip collections 2 weeks later"
      />
    </label>
  );
}
