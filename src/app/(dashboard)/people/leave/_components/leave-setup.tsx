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
    <div className="mx-auto max-w-lg rounded-xl border border-dashed p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarCheck className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Set up leave</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Create the standard leave types (Casual, Sick, Earned, Comp-off, Maternity, LOP) and 2026 public holidays.
        Everything is editable afterwards.
      </p>
      <Button onClick={run} disabled={loading} className="mt-5 gap-1.5">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Set up leave
      </Button>
      {msg && <p className="mt-3 text-[13px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
