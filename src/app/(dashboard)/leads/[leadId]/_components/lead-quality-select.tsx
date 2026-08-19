"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLeadQuality } from "@/actions/lead-quality.actions";

// LeadQuality enum (mirrors Prisma). Only QUALIFIED is ever uploaded to Google;
// JUNK_*/DUPLICATE are deliberately never uploaded.
type LeadQuality =
  | "UNREVIEWED"
  | "QUALIFIED"
  | "JUNK_ACCIDENTAL"
  | "JUNK_WRONG_SERVICE"
  | "JUNK_OUT_OF_AREA"
  | "JUNK_PRICE_ONLY"
  | "JUNK_UNREACHABLE"
  | "DUPLICATE";

const QUALITY_LABEL: Record<LeadQuality, string> = {
  UNREVIEWED: "Unreviewed",
  QUALIFIED: "Qualified",
  JUNK_ACCIDENTAL: "Junk — filled by mistake",
  JUNK_WRONG_SERVICE: "Junk — wrong service",
  JUNK_OUT_OF_AREA: "Junk — out of area",
  JUNK_PRICE_ONLY: "Junk — budget too low",
  JUNK_UNREACHABLE: "Junk — unreachable",
  DUPLICATE: "Duplicate",
};

export function LeadQualitySelect({
  leadId,
  currentQuality,
}: {
  leadId: string;
  currentQuality: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onChange(next: string) {
    if (next === currentQuality) return;
    setPending(true);
    try {
      const res = await setLeadQuality(leadId, next as LeadQuality);
      if (res.success) {
        toast.success(`Lead quality: ${QUALITY_LABEL[next as LeadQuality] ?? next}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to update lead quality");
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={currentQuality} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-[190px]" aria-label="Lead quality">
        <ShieldCheck className="mr-1.5 size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Lead quality" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="UNREVIEWED">Unreviewed</SelectItem>
        <SelectItem value="QUALIFIED">Qualified</SelectItem>
        <SelectGroup>
          <SelectLabel>Junk</SelectLabel>
          <SelectItem value="JUNK_ACCIDENTAL">Filled by mistake</SelectItem>
          <SelectItem value="JUNK_WRONG_SERVICE">Wrong service</SelectItem>
          <SelectItem value="JUNK_OUT_OF_AREA">Out of area</SelectItem>
          <SelectItem value="JUNK_PRICE_ONLY">Budget too low</SelectItem>
          <SelectItem value="JUNK_UNREACHABLE">Unreachable</SelectItem>
          <SelectItem value="DUPLICATE">Duplicate</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
