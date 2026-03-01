"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  PauseIcon,
  PlayIcon,
  StopCircleIcon,
  Loader2Icon,
} from "lucide-react";

import type { CadenceEnrollmentData } from "@/actions/cadence.actions";
import {
  pauseEnrollment,
  resumeEnrollment,
  stopEnrollment,
} from "@/actions/cadence.actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ============================================================
// Constants
// ============================================================

const ENROLLMENT_STATUS_MAP: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  PAUSED: "bg-amber-100 text-amber-700 border-amber-200",
  COMPLETED: "bg-blue-100 text-blue-700 border-blue-200",
  STOPPED: "bg-muted text-foreground/80 border-border",
  EXITED: "bg-purple-100 text-purple-700 border-purple-200",
};

// ============================================================
// Props
// ============================================================

interface EnrollmentsTableProps {
  cadenceId: string;
  enrollments: CadenceEnrollmentData[];
  entityType: string;
}

// ============================================================
// Entity Name Loader
// ============================================================

interface EntityInfo {
  id: string;
  name: string;
  email?: string;
  link: string;
}

function useEntityNames(
  enrollments: CadenceEnrollmentData[],
  entityType: string
) {
  const [entities, setEntities] = React.useState<Record<string, EntityInfo>>(
    {}
  );
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (enrollments.length === 0) return;

    async function loadEntities() {
      setLoading(true);
      try {
        const entityIds = enrollments.map((e) => e.entityId);
        const response = await fetch("/api/cadence-entities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityIds, entityType }),
        });
        if (response.ok) {
          const data = await response.json();
          setEntities(data.entities ?? {});
        }
      } catch {
        // Silently fail — we show entity IDs as fallback
      } finally {
        setLoading(false);
      }
    }

    loadEntities();
  }, [enrollments, entityType]);

  return { entities, loading };
}

// ============================================================
// Component
// ============================================================

export function EnrollmentsTable({
  cadenceId,
  enrollments,
  entityType,
}: EnrollmentsTableProps) {
  const router = useRouter();
  const [stopping, setStopping] = React.useState<CadenceEnrollmentData | null>(
    null
  );
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const { entities, loading: entitiesLoading } = useEntityNames(
    enrollments,
    entityType
  );

  // ---- Pause ----
  async function handlePause(enrollmentId: string) {
    setActionLoading(enrollmentId);
    const result = await pauseEnrollment(enrollmentId);
    setActionLoading(null);

    if (result.success) {
      toast.success("Enrollment paused");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ---- Resume ----
  async function handleResume(enrollmentId: string) {
    setActionLoading(enrollmentId);
    const result = await resumeEnrollment(enrollmentId);
    setActionLoading(null);

    if (result.success) {
      toast.success("Enrollment resumed");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ---- Stop ----
  async function handleStop() {
    if (!stopping) return;
    setActionLoading(stopping.id);
    const result = await stopEnrollment(stopping.id, "Manually stopped");
    setActionLoading(null);

    if (result.success) {
      toast.success("Enrollment stopped");
      setStopping(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // Suppress unused warning — cadenceId may be used for future filtering
  void cadenceId;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
          <CardDescription>
            {enrollments.length} enrollment
            {enrollments.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              No enrollments yet. Enroll leads or contacts from their detail
              pages.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Current Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Execute</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enrollment) => {
                  const entity = entities[enrollment.entityId];
                  const isLoading = actionLoading === enrollment.id;

                  return (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        {entitiesLoading ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : entity ? (
                          <div>
                            <a
                              href={entity.link}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {entity.name}
                            </a>
                            {entity.email && (
                              <p className="text-muted-foreground text-xs">
                                {entity.email}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm font-mono">
                            {enrollment.entityId.slice(0, 12)}...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        Step {enrollment.currentStepOrder + 1}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            ENROLLMENT_STATUS_MAP[enrollment.status] ?? ""
                          }
                        >
                          {enrollment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {enrollment.nextExecuteAt
                          ? format(
                              new Date(enrollment.nextExecuteAt),
                              "MMM d, yyyy HH:mm"
                            )
                          : "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(
                          new Date(enrollment.createdAt),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {enrollment.status === "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePause(enrollment.id)}
                              disabled={isLoading}
                              title="Pause"
                            >
                              {isLoading ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                              ) : (
                                <PauseIcon className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {enrollment.status === "PAUSED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleResume(enrollment.id)}
                              disabled={isLoading}
                              title="Resume"
                            >
                              {isLoading ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                              ) : (
                                <PlayIcon className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {["ACTIVE", "PAUSED"].includes(
                            enrollment.status
                          ) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setStopping(enrollment)}
                              disabled={isLoading}
                              title="Stop"
                            >
                              <StopCircleIcon className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stop Confirmation */}
      <AlertDialog open={!!stopping} onOpenChange={() => setStopping(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Enrollment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop this enrollment? The entity will no
              longer receive further cadence steps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Stop Enrollment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
