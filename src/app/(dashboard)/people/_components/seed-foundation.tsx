"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedHrFoundation } from "@/actions/hr-employee.actions";

export function SeedFoundation() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    const res = await seedHrFoundation();
    setLoading(false);
    if (res.success) {
      const c = res.data.created;
      setMsg(`Set up ${c.entities} entities, ${c.verticals} verticals, ${c.departments} departments, ${c.designations} designations.`);
      router.refresh();
    } else {
      setMsg(res.error);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-card sm:p-10">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Building2 className="size-6" />
      </div>
      <h3 className="font-editorial mt-5 text-title leading-tight">Set up your organisation</h3>
      <p className="mx-auto mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
        Seed the six PropertyPlush legal entities, business verticals, departments and designations.
        You can rename or add to them anytime — this just gets you started in one click.
      </p>
      <Button onClick={run} disabled={loading} className="mt-5 gap-1.5">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Set up organisation
      </Button>
      {msg && <p className="mt-3 text-body text-muted-foreground">{msg}</p>}
    </div>
  );
}
