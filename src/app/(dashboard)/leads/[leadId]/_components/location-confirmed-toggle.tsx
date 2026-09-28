"use client";

// ============================================================
// "Customer confirmed Hosa Road works."
// ------------------------------------------------------------
// One of the four facts a lead now needs before it can be called Qualified.
// It is the only one a rep has to actually ask the customer, and the only one
// that cannot be inferred from a form, which is exactly why it is a deliberate
// tick rather than something derived.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

import { setLeadLocationConfirmed } from "@/actions/lead.actions";
import { Switch } from "@/components/ui/switch";

export function LocationConfirmedToggle({
  leadId,
  confirmed,
}: {
  leadId: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = React.useState(confirmed);
  const [saving, setSaving] = React.useState(false);

  async function toggle(next: boolean) {
    const previous = on;
    setOn(next); // optimistic — reverted below if the write fails
    setSaving(true);
    try {
      const res = await setLeadLocationConfirmed(leadId, next);
      if (res.success) {
        toast.success(next ? "Location confirmed with the customer." : "Location confirmation removed.");
        router.refresh();
      } else {
        setOn(previous);
        toast.error(res.error);
      }
    } catch {
      setOn(previous);
      toast.error("Could not save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <MapPin className="text-muted-foreground size-4 shrink-0" />
      <span className="flex-1">
        Customer confirmed Hosa Road works
        <span className="text-muted-foreground block text-xs">
          Needed before this lead can be marked Qualified.
        </span>
      </span>
      <Switch checked={on} onCheckedChange={toggle} disabled={saving} />
    </label>
  );
}
