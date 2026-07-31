"use client";

// ============================================================
// Lead-source control — which marketing channel this enquiry is credited to.
// Mirrors EnquiryVenueSelect: pick a value, it saves immediately via the
// assignEnquirySource server action.
//
// Most enquiries arrive with this already set by the capture pipeline; this
// control exists for walk-ins and phone calls logged by hand, and to correct a
// mis-attributed one.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Megaphone } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignEnquirySource } from "@/actions/contact.actions";
import { ENQUIRY_SOURCE_OPTIONS } from "@/lib/enquiry-source";

// A shadcn SelectItem can't hold value="" — this sentinel maps to null.
const NO_SOURCE = "NONE";

export function EnquirySourceSelect({
  contactId,
  currentSource,
}: {
  contactId: string;
  currentSource: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(currentSource ?? NO_SOURCE);
  const [pending, startTransition] = React.useTransition();

  // Keep in sync when the server sends a fresh value (e.g. after refresh).
  React.useEffect(() => {
    setValue(currentSource ?? NO_SOURCE);
  }, [currentSource]);

  function onChange(next: string) {
    const previous = value;
    setValue(next); // optimistic
    startTransition(async () => {
      const res = await assignEnquirySource(contactId, next === NO_SOURCE ? null : next);
      if (!res.success) {
        setValue(previous); // roll back
        toast.error(res.error);
        return;
      }
      toast.success("Lead source updated");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Megaphone className="size-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="h-9 w-[210px]" aria-label="Lead source">
          <SelectValue placeholder="Record lead source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SOURCE}>Not recorded</SelectItem>
          {ENQUIRY_SOURCE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
