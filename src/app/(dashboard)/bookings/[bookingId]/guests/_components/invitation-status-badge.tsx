"use client";

import { Badge } from "@/components/ui/badge";
import {
  INVITATION_STATUS_COLORS,
  INVITATION_STATUS_LABELS,
} from "@/lib/constants";

interface InvitationStatusBadgeProps {
  status: string | null;
}

export function InvitationStatusBadge({ status }: InvitationStatusBadgeProps) {
  const displayStatus = status || "NOT_SENT";
  const colorClass = INVITATION_STATUS_COLORS[displayStatus] || INVITATION_STATUS_COLORS.NOT_SENT;
  const label = INVITATION_STATUS_LABELS[displayStatus] || "Not Sent";

  return (
    <Badge variant="outline" className={colorClass}>
      {label}
    </Badge>
  );
}
