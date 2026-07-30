"use client";

// ============================================================
// Enquiry Hall/Property control — which venue this enquiry (Contact) is about.
// Mirrors EnquiryStatusSelect: pick a value, it saves immediately via the
// assignEnquiryVenue server action.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignEnquiryVenue } from "@/actions/contact.actions";

// A shadcn SelectItem can't hold value="" — this sentinel maps to null.
const NO_VENUE = "NONE";

export function EnquiryVenueSelect({
  contactId,
  currentVenueId,
  venues,
}: {
  contactId: string;
  currentVenueId: string | null;
  venues: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(currentVenueId ?? NO_VENUE);
  const [pending, startTransition] = React.useTransition();

  // Keep in sync when the server sends a fresh value (e.g. after refresh).
  React.useEffect(() => {
    setValue(currentVenueId ?? NO_VENUE);
  }, [currentVenueId]);

  function onChange(next: string) {
    const previous = value;
    setValue(next); // optimistic
    startTransition(async () => {
      const res = await assignEnquiryVenue(contactId, next === NO_VENUE ? null : next);
      if (!res.success) {
        setValue(previous); // roll back
        toast.error(res.error);
        return;
      }
      toast.success("Hall / Property updated");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="size-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="h-9 w-[190px]" aria-label="Hall / Property">
          <SelectValue placeholder="Assign hall / property" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_VENUE}>Not assigned</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
