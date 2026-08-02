"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedLeaveSetup } from "@/actions/hr-leave.actions";

export function LeaveSetup() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function run() {
    setLoading(true); setMsg(null);
    const res = await seedLeaveSetup();
    setLoading(false);
    if (res.success) { setMsg(`Created ${res.data.types} leave types and ${res.data.holidays} holidays.`); router.refresh(); }
    else setMsg(res.error);
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed bg-card p-8 text-center shadow-card sm:p-10">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CalendarCheck className="size-6" />
      </div>
      <h3 className="font-editorial mt-5 text-title leading-tight">Set up leave</h3>
      <p className="mx-auto mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
        Create the standard leave types (Casual, Sick, Earned, Comp-off, Maternity, LOP) and 2026 public holidays.
        Everything is editable afterwards.
      </p>
      <Button onClick={run} disabled={loading} className="mt-5 gap-1.5">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Set up leave
      </Button>
      {msg && <p className="mt-3 text-body text-muted-foreground">{msg}</p>}
    </div>
  );
}
