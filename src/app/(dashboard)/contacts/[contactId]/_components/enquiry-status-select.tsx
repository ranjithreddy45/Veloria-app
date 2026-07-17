"use client";

// ============================================================
// Enquiry status control — the pipeline state of an enquiry (Contact).
// Mirrors the lead status select: pick a value, it saves immediately.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setEnquiryStatus } from "@/actions/contact.actions";
import {
  ENQUIRY_STATUS_OPTIONS,
  NEW_ENQUIRY_VALUE,
} from "../../_components/enquiry-status";

export function EnquiryStatusSelect({
  contactId,
  currentStatus,
}: {
  contactId: string;
  currentStatus: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(currentStatus ?? NEW_ENQUIRY_VALUE);
  const [pending, startTransition] = React.useTransition();

  // Keep in sync when the server sends a fresh value (e.g. after refresh).
  React.useEffect(() => {
    setValue(currentStatus ?? NEW_ENQUIRY_VALUE);
  }, [currentStatus]);

  function onChange(next: string) {
    const previous = value;
    setValue(next); // optimistic
    startTransition(async () => {
      const res = await setEnquiryStatus(
        contactId,
        next === NEW_ENQUIRY_VALUE ? null : next
      );
      if (!res.success) {
        setValue(previous); // roll back
        toast.error(res.error);
        return;
      }
      toast.success("Enquiry status updated");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="h-9 w-[170px]" aria-label="Enquiry status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ENQUIRY_STATUS_OPTIONS.map((o) => (
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
