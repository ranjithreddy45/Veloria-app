"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FilterIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { resolveIncident } from "@/actions/emergency.actions";
import {
  EMERGENCY_TYPE_LABELS,
  EMERGENCY_SEVERITY_COLORS,
  EMERGENCY_STATUS_COLORS,
} from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface ProtocolRef {
  id: string;
  name: string;
  type: string;
}

interface IncidentData {
  id: string;
  bookingId: string | null;
  protocolId: string | null;
  protocol: ProtocolRef | null;
  type: string;
  description: string;
  severity: string;
  status: string;
  resolvedAt: string | null;
  notes: string | null;
  reportedById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProtocolData {
  id: string;
  name: string;
  type: string;
}

interface IncidentListProps {
  incidents: IncidentData[];
  protocols: ProtocolData[];
}

// ============================================================
// IncidentList Component
// ============================================================

export function IncidentList({ incidents, protocols }: IncidentListProps) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [filterSeverity, setFilterSeverity] = React.useState<string>("all");
  const [resolveId, setResolveId] = React.useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  void protocols; // available for future filtering

  const filtered = React.useMemo(() => {
    return incidents.filter((inc) => {
      if (filterStatus !== "all" && inc.status !== filterStatus) return false;
      if (filterSeverity !== "all" && inc.severity !== filterSeverity) return false;
      return true;
    });
  }, [incidents, filterStatus, filterSeverity]);

  async function handleResolve() {
    if (!resolveId) return;
    setSubmitting(true);
    try {
      const result = await resolveIncident(resolveId, { notes: resolveNotes || undefined });
      if (result.success) {
        toast.success("Incident resolved successfully");
        setResolveId(null);
        setResolveNotes("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to resolve incident");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  const sortedFiltered = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const statusOrder: Record<string, number> = { OPEN: 0, RESPONDING: 1, RESOLVED: 2 };
      const sa = statusOrder[a.status] ?? 3;
      const sb = statusOrder[b.status] ?? 3;
      if (sa !== sb) return sa - sb;
      const sevA = severityOrder[a.severity] ?? 3;
      const sevB = severityOrder[b.severity] ?? 3;
      if (sevA !== sevB) return sevA - sevB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filtered]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Emergency Incidents
          </h2>
          <div className="flex items-center gap-2">
            <FilterIcon className="size-4 text-zinc-400" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="RESPONDING">Responding</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {sortedFiltered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircleIcon className="mx-auto size-10 text-green-300 dark:text-green-600" />
              <p className="text-muted-foreground mt-3 text-sm">
                No emergency incidents found. All clear!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedFiltered.map((incident) => (
              <Card key={incident.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {incident.status === "OPEN" && (
                          <AlertTriangleIcon className="size-4 text-red-500 flex-shrink-0" />
                        )}
                        {incident.status === "RESPONDING" && (
                          <ClockIcon className="size-4 text-amber-500 flex-shrink-0" />
                        )}
                        {incident.status === "RESOLVED" && (
                          <CheckCircleIcon className="size-4 text-green-500 flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {EMERGENCY_TYPE_LABELS[incident.type] ?? incident.type} Incident
                        </span>
                      </CardTitle>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Reported {formatDate(incident.createdAt)}
                        {incident.protocol && (
                          <> &middot; Protocol: {incident.protocol.name}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge
                        status={incident.severity}
                        colorMap={EMERGENCY_SEVERITY_COLORS}
                      />
                      <StatusBadge
                        status={incident.status}
                        colorMap={EMERGENCY_STATUS_COLORS}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {incident.description}
                  </p>

                  {incident.notes && (
                    <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800">
                      <p className="text-xs font-medium text-zinc-500">Resolution Notes</p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        {incident.notes}
                      </p>
                    </div>
                  )}

                  {incident.resolvedAt && (
                    <p className="text-muted-foreground text-xs">
                      Resolved: {formatDate(incident.resolvedAt)}
                    </p>
                  )}

                  {incident.bookingId && (
                    <Badge variant="outline" className="text-[10px]">
                      Booking: {incident.bookingId.slice(0, 8)}...
                    </Badge>
                  )}

                  {incident.status !== "RESOLVED" && (
                    <div className="pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResolveId(incident.id);
                          setResolveNotes("");
                        }}
                      >
                        <CheckCircleIcon className="mr-1 size-3" />
                        Resolve Incident
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Resolve Incident Dialog */}
      <Dialog open={!!resolveId} onOpenChange={() => setResolveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add optional resolution notes before marking this incident as resolved.
            </p>
            <Textarea
              placeholder="Resolution notes (optional)..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveId(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={submitting}>
              {submitting ? "Resolving..." : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
