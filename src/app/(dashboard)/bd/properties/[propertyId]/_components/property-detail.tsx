"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  ImageIcon,
  Megaphone,
  UserCog,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import {
  setAcqOnboardingTaskDone,
  assignPropertyManager,
  markPropertyAvailable,
} from "@/actions/acq-property.actions";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { acqCan } from "@/lib/acq/rbac";

// ============================================================
// Types — matches getAcqProperty() serialized shape
// ============================================================

export interface OnboardingTask {
  id: string;
  title: string;
  done: boolean;
  assignee?: { name: string | null } | null;
}

export interface AcqPropertyDetail {
  id: string;
  propertyName: string;
  propertyType: string;
  ownerName: string | null;
  city: string | null;
  locality: string | null;
  status: string;
  acquisitionDate: string;
  availableAt: string | null;
  propertyManagerId: string | null;
  propertyManager?: { id: string; name: string | null } | null;
  deal?: {
    id: string;
    name: string;
    ownerName?: string | null;
    attachments?: { id: string; url: string; label: string | null }[];
  } | null;
  onboardingProject?: {
    id: string;
    status: "OPEN" | "COMPLETED";
    tasks: OnboardingTask[];
  } | null;
}

export interface Manager {
  id: string;
  name: string | null;
  role: string;
}

interface PropertyDetailProps {
  property: AcqPropertyDetail;
  managers: Manager[];
  userRole?: string;
}

// ============================================================
// Status hue map
// ============================================================

const STATUS_HUE: Record<
  string,
  "amber" | "emerald" | "blue" | "slate" | "rose"
> = {
  ONBOARDING: "amber",
  AVAILABLE: "emerald",
  ACTIVE: "blue",
  PAUSED: "slate",
  OFF_BOARDED: "rose",
};

const STATUS_LABEL: Record<string, string> = {
  ONBOARDING: "Onboarding",
  AVAILABLE: "Available",
  ACTIVE: "Active",
  PAUSED: "Paused",
  OFF_BOARDED: "Off-boarded",
};

function formatType(type: string): string {
  return type
    .split("_")
    .map((w) => (w.length > 0 ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// PropertyDetail
// ============================================================

export function PropertyDetail({ property, managers, userRole }: PropertyDetailProps) {
  const router = useRouter();
  const canPublish = acqCan(userRole, "property:available");
  const canOnboard = acqCan(userRole, "onboarding:complete");
  const [isPublishing, startPublish] = useTransition();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isAssigning, startAssign] = useTransition();
  const [selectedManagerId, setSelectedManagerId] = useState<string>(
    property.propertyManagerId ?? ""
  );

  const tasks = property.onboardingProject?.tasks ?? [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.reduce((acc, t) => acc + (t.done ? 1 : 0), 0);
  const allTasksDone = totalTasks > 0 && doneTasks === totalTasks;
  const hasManager = Boolean(property.propertyManagerId);

  const canMarkAvailable =
    property.status === "ONBOARDING" && allTasksDone && hasManager;

  const place = [property.city, property.locality].filter(Boolean).join(" · ");

  // --- Task toggle ---------------------------------------------------------
  // Runs outside a transition so it can coexist with assign/publish actions.
  async function handleToggleTask(task: OnboardingTask) {
    setPendingTaskId(task.id);
    const res = await setAcqOnboardingTaskDone(task.id, !task.done);
    if (res.success) {
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not update task.");
    }
    setPendingTaskId(null);
  }

  // --- Assign manager ------------------------------------------------------
  function handleAssign() {
    if (!selectedManagerId) {
      toast.error("Select a manager first.");
      return;
    }
    startAssign(async () => {
      const res = await assignPropertyManager(property.id, selectedManagerId);
      if (res.success) {
        toast.success("Property manager assigned.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not assign manager.");
      }
    });
  }

  // --- Mark available ------------------------------------------------------
  function handleMarkAvailable() {
    startPublish(async () => {
      const res = await markPropertyAvailable(property.id);
      if (res.success) {
        toast.success("Sales notified — now bookable");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not publish property.");
      }
    });
  }

  const currentManagerName = property.propertyManager?.name ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header summary */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <Building2 className="size-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-medium text-foreground">
                  {property.propertyName}
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  {formatType(property.propertyType)}
                </span>
              </div>
            </div>
            <StatusPill
              label={STATUS_LABEL[property.status] ?? property.status}
              hue={STATUS_HUE[property.status] ?? "neutral"}
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {/* Owner links back to its originating deal when one exists. */}
            <div className="flex flex-col gap-0.5">
              <dt className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                Owner
              </dt>
              <dd className="text-[12.5px] text-foreground">
                {property.deal ? (
                  <Link
                    href={`/bd/deals/${property.deal.id}`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {property.ownerName ?? "—"}
                    <ArrowUpRight className="size-3" />
                  </Link>
                ) : (
                  property.ownerName ?? "—"
                )}
              </dd>
            </div>
            <Field label="Type" value={formatType(property.propertyType)} />
            <Field label="Location" value={place || "—"} />
            <Field
              label="Acquired"
              value={formatDate(property.acquisitionDate)}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Property images — pulled from the deal's PHOTO attachments. */}
      <PropertyPhotos deal={property.deal} />

      {/* Sales-notification banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3">
        <Megaphone className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-[12.5px] leading-relaxed text-amber-800">
          <span className="font-semibold">
            Sales is notified ONLY when this property is marked Available.
          </span>{" "}
          Until then it stays hidden from the bookable inventory.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Onboarding checklist */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-[13.5px]">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              Onboarding checklist
            </CardTitle>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {doneTasks}/{totalTasks} done
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {totalTasks === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                No onboarding tasks for this property.
              </p>
            ) : (
              tasks.map((task) => {
                const pending = pendingTaskId === task.id;
                return (
                  <label
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60",
                      pending && "opacity-60"
                    )}
                  >
                    <Checkbox
                      checked={task.done}
                      disabled={pending || !canOnboard}
                      onCheckedChange={() => handleToggleTask(task)}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "truncate text-[13px]",
                          task.done
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        )}
                      >
                        {task.title}
                      </span>
                      {task.assignee?.name && (
                        <span className="text-[11.5px] text-muted-foreground">
                          {task.assignee.name}
                        </span>
                      )}
                    </div>
                    {pending && (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    )}
                  </label>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right column: manager + publish */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[13.5px]">
                <UserCog className="size-4 text-muted-foreground" />
                Property Manager
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="text-[12.5px]">
                <span className="text-muted-foreground">Current: </span>
                {currentManagerName ? (
                  <span className="font-medium text-foreground">
                    {currentManagerName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </div>
              <Select
                value={selectedManagerId}
                onValueChange={setSelectedManagerId}
                disabled={isAssigning || !canOnboard}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name ?? "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAssign}
                disabled={
                  isAssigning ||
                  !canOnboard ||
                  !selectedManagerId ||
                  selectedManagerId === property.propertyManagerId
                }
              >
                {isAssigning && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Assign
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13.5px]">Publish to Sales</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                onClick={handleMarkAvailable}
                disabled={!canMarkAvailable || isPublishing || !canPublish}
                className="w-full"
              >
                {isPublishing && <Loader2 className="size-4 animate-spin" />}
                Mark Available
              </Button>
              {!canMarkAvailable && property.status === "ONBOARDING" && (
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {!allTasksDone && "Complete every onboarding task"}
                  {!allTasksDone && !hasManager && " and "}
                  {!hasManager && "assign a property manager"}
                  {" to publish."}
                </p>
              )}
              {property.status !== "ONBOARDING" && (
                <p className="text-[11.5px] text-muted-foreground">
                  This property is already{" "}
                  {STATUS_LABEL[property.status] ?? property.status}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Property images come from the originating deal's PHOTO attachments (there is
// no image column on AcqProperty — see flagged schema gap). When a deal link
// exists the "Manage photos" action deep-links to the deal's evaluation tab.
function PropertyPhotos({
  deal,
}: {
  deal: AcqPropertyDetail["deal"];
}) {
  const photos = deal?.attachments ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-[13.5px]">
          <ImageIcon className="size-4 text-muted-foreground" />
          Property images
        </CardTitle>
        {deal && (
          <Link
            href={`/bd/deals/${deal.id}`}
            className="text-[12px] font-medium text-primary hover:underline"
          >
            Manage photos
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            No images yet. Photos uploaded on the acquisition deal appear here.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.label ?? "Property photo"}
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[12.5px] text-foreground">{value}</dd>
    </div>
  );
}
