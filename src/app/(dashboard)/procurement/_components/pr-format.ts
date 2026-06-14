import type { Hue } from "@/components/shared/status-pill";
import type { PRStatus } from "@/actions/procurement.actions";

export const PR_STATUS_LABEL: Record<PRStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  ORDERED: "Ordered",
  RECEIVED: "Received",
  REJECTED: "Rejected",
};

export function prStatusHue(status: PRStatus): Hue {
  switch (status) {
    case "PENDING":
      return "amber";
    case "APPROVED":
      return "blue";
    case "ORDERED":
      return "violet";
    case "RECEIVED":
      return "emerald";
    case "REJECTED":
      return "rose";
    default:
      return "slate";
  }
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
