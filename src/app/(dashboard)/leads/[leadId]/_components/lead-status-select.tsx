"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
// LeadStatus type matching Prisma schema
type LeadStatus = "NEW" | "NOT_CONNECTED" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";

import { updateLeadStatus } from "@/actions/lead.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUS_COLORS } from "@/lib/constants";

// ============================================================
// Lead Status Options
// ============================================================

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "NOT_CONNECTED", label: "Not Connected" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

// ============================================================
// LeadStatusSelect Component
// ============================================================

interface LeadStatusSelectProps {
  leadId: string;
  currentStatus: string;
}

export function LeadStatusSelect({
  leadId,
  currentStatus,
}: LeadStatusSelectProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setIsPending(true);
    try {
      const result = await updateLeadStatus(leadId, newStatus as LeadStatus);
      if (result.success) {
        toast.success(`Status updated to ${newStatus.replace(/_/g, " ")}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Change status" />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STATUSES.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
