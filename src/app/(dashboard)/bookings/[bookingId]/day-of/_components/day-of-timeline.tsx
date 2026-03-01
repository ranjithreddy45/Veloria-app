"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClockIcon,
  PlusIcon,
  Loader2Icon,
  PlayIcon,
  CheckCircle2Icon,
  TrashIcon,
  GripVerticalIcon,
  SkipForwardIcon,
  CircleDotIcon,
  XIcon,
  UserIcon,
  StickyNoteIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ZapIcon,
  RadioIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  TIMELINE_STATUS_COLORS,
  TIMELINE_ITEM_STATUS_COLORS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  addTimelineItem,
  updateTimelineItem,
  updateItemStatus,
  removeTimelineItem,
  reorderItems,
  updateTimelineStatus,
} from "@/actions/event-day.actions";

// ============================================================
// Types
// ============================================================

interface StaffMember {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface TimelineItemData {
  id: string;
  time: string;
  activity: string;
  status: string;
  completedAt: string | null;
  notes: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  timelineId: string;
  assigneeId: string | null;
  assignee: StaffMember | null;
}

interface TimelineData {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  bookingId: string;
  items: TimelineItemData[];
}

interface DayOfTimelineProps {
  timeline: TimelineData;
  bookingId: string;
  eventName: string;
  eventDate: string;
  staff: StaffMember[];
}

// ============================================================
// Day-of Timeline Component
// ============================================================

export function DayOfTimeline({
  timeline,
  bookingId,
  eventName,
  eventDate,
  staff,
}: DayOfTimelineProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Add form state
  const [newTime, setNewTime] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --------------------------------------------------------
  // Helpers
  // --------------------------------------------------------

  const formatCurrentTime = useCallback(() => {
    return currentTime.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, [currentTime]);

  const formatCurrentDate = useCallback(() => {
    return currentTime.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [currentTime]);

  function resetAddForm() {
    setNewTime("");
    setNewActivity("");
    setNewAssigneeId("");
    setNewNotes("");
    setShowAddForm(false);
  }

  const completedCount = timeline.items.filter(
    (i) => i.status === "DONE"
  ).length;
  const totalCount = timeline.items.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // --------------------------------------------------------
  // Actions
  // --------------------------------------------------------

  function handleAddItem() {
    if (!newTime.trim() || !newActivity.trim()) {
      toast.error("Time and activity are required");
      return;
    }

    startTransition(async () => {
      const result = await addTimelineItem(timeline.id, {
        time: newTime.trim(),
        activity: newActivity.trim(),
        assigneeId: newAssigneeId || undefined,
        notes: newNotes.trim() || undefined,
      });

      if (result.success) {
        toast.success("Item added");
        resetAddForm();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to add item");
      }
    });
  }

  function handleStatusChange(itemId: string, status: string) {
    startTransition(async () => {
      const result = await updateItemStatus(itemId, status);
      if (result.success) {
        toast.success(`Marked as ${status.replace("_", " ").toLowerCase()}`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  }

  function handleRemoveItem(itemId: string) {
    startTransition(async () => {
      const result = await removeTimelineItem(itemId);
      if (result.success) {
        toast.success("Item removed");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to remove item");
      }
    });
  }

  function handleMoveItem(itemId: string, direction: "up" | "down") {
    const currentIndex = timeline.items.findIndex((i) => i.id === itemId);
    if (currentIndex === -1) return;

    const newIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= timeline.items.length) return;

    const reordered = [...timeline.items];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((item, idx) => ({
      id: item.id,
      order: idx,
    }));

    startTransition(async () => {
      const result = await reorderItems(timeline.id, updates);
      if (result.success) {
        router.refresh();
      } else {
        toast.error(result.error || "Failed to reorder");
      }
    });
  }

  function handleTimelineStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateTimelineStatus(timeline.id, status);
      if (result.success) {
        const label =
          status === "LIVE"
            ? "Timeline is now LIVE!"
            : status === "COMPLETED"
              ? "Timeline marked as completed"
              : "Timeline set to planned";
        toast.success(label);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update timeline status");
      }
    });
  }

  // --------------------------------------------------------
  // Item Status Icons
  // --------------------------------------------------------

  function getStatusIcon(status: string) {
    switch (status) {
      case "IN_PROGRESS":
        return <CircleDotIcon className="size-5 text-blue-600" />;
      case "DONE":
        return <CheckCircle2Icon className="size-5 text-emerald-600" />;
      case "SKIPPED":
        return <SkipForwardIcon className="size-5 text-orange-600" />;
      default:
        return <ClockIcon className="size-5 text-zinc-400" />;
    }
  }

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Live Clock & Status Bar */}
      <Card className="border-2 border-zinc-200">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Clock */}
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-zinc-100">
                <ClockIcon className="size-7 text-zinc-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {formatCurrentTime()}
                </p>
                <p className="text-muted-foreground text-sm">
                  {formatCurrentDate()}
                </p>
              </div>
            </div>

            {/* Status + Progress */}
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={timeline.status}
                  colorMap={TIMELINE_STATUS_COLORS}
                  className="text-sm px-3 py-1"
                />
                {timeline.status === "LIVE" && (
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
                  </span>
                )}
              </div>
              {totalCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {completedCount}/{totalCount} completed
                  </span>
                  <div className="h-2 w-24 rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Event Info */}
          <Separator className="my-4" />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium">{eventName}</span>
            <span className="text-muted-foreground">
              {formatDate(eventDate)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Status Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {timeline.status === "PLANNED" && (
          <Button
            onClick={() => handleTimelineStatusChange("LIVE")}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            {isPending ? (
              <Loader2Icon className="mr-2 size-5 animate-spin" />
            ) : (
              <RadioIcon className="mr-2 size-5" />
            )}
            Go Live
          </Button>
        )}
        {timeline.status === "LIVE" && (
          <Button
            onClick={() => handleTimelineStatusChange("COMPLETED")}
            disabled={isPending}
            variant="outline"
            size="lg"
          >
            {isPending ? (
              <Loader2Icon className="mr-2 size-5 animate-spin" />
            ) : (
              <CheckCircle2Icon className="mr-2 size-5" />
            )}
            Complete Event
          </Button>
        )}
        {timeline.status === "COMPLETED" && (
          <Button
            onClick={() => handleTimelineStatusChange("PLANNED")}
            disabled={isPending}
            variant="outline"
            size="sm"
          >
            Reset to Planned
          </Button>
        )}

        <div className="ml-auto">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? "secondary" : "default"}
            size="lg"
          >
            {showAddForm ? (
              <>
                <XIcon className="mr-2 size-5" />
                Cancel
              </>
            ) : (
              <>
                <PlusIcon className="mr-2 size-5" />
                Add Item
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Timeline Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-time">Time *</Label>
                <Input
                  id="add-time"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="h-12 text-lg"
                  placeholder="e.g. 10:00 AM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-assignee">Assignee</Label>
                <Select
                  value={newAssigneeId}
                  onValueChange={setNewAssigneeId}
                >
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No assignee</SelectItem>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-activity">Activity *</Label>
              <Input
                id="add-activity"
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                placeholder="e.g. Guest arrival and registration"
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={resetAddForm}
                disabled={isPending}
                size="lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddItem}
                disabled={isPending}
                size="lg"
              >
                {isPending ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <PlusIcon className="mr-2 size-4" />
                )}
                Add Item
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline Items */}
      {timeline.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ZapIcon className="text-muted-foreground mb-4 size-10" />
            <p className="text-muted-foreground text-sm">
              No timeline items yet. Add your first activity to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {timeline.items.map((item, index) => (
            <TimelineItemCard
              key={item.id}
              item={item}
              index={index}
              totalItems={timeline.items.length}
              isLive={timeline.status === "LIVE"}
              isPending={isPending}
              onStatusChange={handleStatusChange}
              onRemove={handleRemoveItem}
              onMove={handleMoveItem}
              staff={staff}
              startTransition={startTransition}
              router={router}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Timeline Item Card
// ============================================================

interface TimelineItemCardProps {
  item: TimelineItemData;
  index: number;
  totalItems: number;
  isLive: boolean;
  isPending: boolean;
  onStatusChange: (itemId: string, status: string) => void;
  onRemove: (itemId: string) => void;
  onMove: (itemId: string, direction: "up" | "down") => void;
  staff: StaffMember[];
  startTransition: (callback: () => void) => void;
  router: ReturnType<typeof useRouter>;
}

function TimelineItemCard({
  item,
  index,
  totalItems,
  isLive,
  isPending,
  onStatusChange,
  onRemove,
  onMove,
  staff,
  startTransition,
  router,
}: TimelineItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTime, setEditTime] = useState(item.time);
  const [editActivity, setEditActivity] = useState(item.activity);
  const [editAssigneeId, setEditAssigneeId] = useState(
    item.assigneeId || ""
  );
  const [editNotes, setEditNotes] = useState(item.notes || "");

  function handleSaveEdit() {
    startTransition(async () => {
      const result = await updateTimelineItem(item.id, {
        time: editTime,
        activity: editActivity,
        assigneeId: editAssigneeId || undefined,
        notes: editNotes || undefined,
      });

      if (result.success) {
        toast.success("Item updated");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update item");
      }
    });
  }

  function handleCancelEdit() {
    setEditTime(item.time);
    setEditActivity(item.activity);
    setEditAssigneeId(item.assigneeId || "");
    setEditNotes(item.notes || "");
    setIsEditing(false);
  }

  // Format time for display (convert HH:mm to readable)
  function displayTime(time: string) {
    // If it's already in HH:mm format, convert to 12-hour
    if (/^\d{2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const hour12 = h % 12 || 12;
      return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
    }
    return time;
  }

  const isDone = item.status === "DONE";
  const isSkipped = item.status === "SKIPPED";
  const isInProgress = item.status === "IN_PROGRESS";

  const cardBorderClass = isInProgress
    ? "border-blue-300 bg-blue-50/30"
    : isDone
      ? "border-emerald-200 bg-emerald-50/20"
      : isSkipped
        ? "border-orange-200 bg-orange-50/20"
        : "border-zinc-200";

  return (
    <Card className={`transition-colors ${cardBorderClass}`}>
      <CardContent className="p-4 sm:p-5">
        {isEditing ? (
          /* Edit mode */
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="h-12 text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={editAssigneeId}
                  onValueChange={setEditAssigneeId}
                >
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No assignee</SelectItem>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Activity</Label>
              <Input
                value={editActivity}
                onChange={(e) => setEditActivity(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isPending}
                size="lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isPending}
                size="lg"
              >
                {isPending ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="mr-2 size-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        ) : (
          /* Display mode */
          <div className="flex gap-3 sm:gap-4">
            {/* Reorder Buttons */}
            <div className="flex flex-col items-center gap-1 pt-1">
              <button
                onClick={() => onMove(item.id, "up")}
                disabled={index === 0 || isPending}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                aria-label="Move up"
              >
                <ChevronUpIcon className="size-5" />
              </button>
              <GripVerticalIcon className="size-4 text-zinc-300" />
              <button
                onClick={() => onMove(item.id, "down")}
                disabled={index === totalItems - 1 || isPending}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                aria-label="Move down"
              >
                <ChevronDownIcon className="size-5" />
              </button>
            </div>

            {/* Status icon + time */}
            <div className="flex flex-col items-center gap-1 min-w-[60px] sm:min-w-[80px]">
              <div className="mt-0.5">
                {getStatusIcon(item.status)}
              </div>
              <p
                className={`text-lg sm:text-xl font-bold tabular-nums leading-tight text-center ${
                  isDone || isSkipped
                    ? "text-zinc-400 line-through"
                    : "text-zinc-900"
                }`}
              >
                {displayTime(item.time)}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start gap-2">
                <p
                  className={`text-base sm:text-lg font-medium ${
                    isDone || isSkipped
                      ? "text-zinc-400 line-through"
                      : "text-zinc-900"
                  }`}
                >
                  {item.activity}
                </p>
                <StatusBadge
                  status={item.status}
                  colorMap={TIMELINE_ITEM_STATUS_COLORS}
                />
              </div>

              {/* Assignee */}
              {item.assignee && (
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-500">
                  <UserIcon className="size-3.5" />
                  <span>{item.assignee.name || item.assignee.email}</span>
                </div>
              )}

              {/* Notes */}
              {item.notes && (
                <div className="mt-1.5 flex items-start gap-1.5 text-sm text-zinc-500">
                  <StickyNoteIcon className="size-3.5 mt-0.5 shrink-0" />
                  <span className="whitespace-pre-wrap">{item.notes}</span>
                </div>
              )}

              {/* Completed timestamp */}
              {item.completedAt && (
                <p className="mt-1 text-xs text-emerald-600">
                  Completed at{" "}
                  {new Date(item.completedAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>
              )}

              {/* Action Buttons */}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status === "PENDING" && (
                  <>
                    <Button
                      onClick={() =>
                        onStatusChange(item.id, "IN_PROGRESS")
                      }
                      disabled={isPending}
                      size="sm"
                      variant="outline"
                      className="h-10 min-w-[100px] touch-manipulation"
                    >
                      <PlayIcon className="mr-1.5 size-4" />
                      Start
                    </Button>
                    <Button
                      onClick={() => onStatusChange(item.id, "DONE")}
                      disabled={isPending}
                      size="sm"
                      variant="outline"
                      className="h-10 min-w-[100px] touch-manipulation text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle2Icon className="mr-1.5 size-4" />
                      Done
                    </Button>
                    <Button
                      onClick={() => onStatusChange(item.id, "SKIPPED")}
                      disabled={isPending}
                      size="sm"
                      variant="ghost"
                      className="h-10 touch-manipulation text-orange-600 hover:bg-orange-50"
                    >
                      <SkipForwardIcon className="mr-1.5 size-4" />
                      Skip
                    </Button>
                  </>
                )}
                {item.status === "IN_PROGRESS" && (
                  <>
                    <Button
                      onClick={() => onStatusChange(item.id, "DONE")}
                      disabled={isPending}
                      size="sm"
                      className="h-10 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white touch-manipulation"
                    >
                      <CheckCircle2Icon className="mr-1.5 size-4" />
                      Mark Done
                    </Button>
                    <Button
                      onClick={() => onStatusChange(item.id, "SKIPPED")}
                      disabled={isPending}
                      size="sm"
                      variant="ghost"
                      className="h-10 touch-manipulation text-orange-600 hover:bg-orange-50"
                    >
                      <SkipForwardIcon className="mr-1.5 size-4" />
                      Skip
                    </Button>
                  </>
                )}
                {(item.status === "DONE" || item.status === "SKIPPED") && (
                  <Button
                    onClick={() => onStatusChange(item.id, "PENDING")}
                    disabled={isPending}
                    size="sm"
                    variant="ghost"
                    className="h-10 touch-manipulation text-zinc-500"
                  >
                    <ClockIcon className="mr-1.5 size-4" />
                    Reset
                  </Button>
                )}

                <div className="ml-auto flex gap-1">
                  <Button
                    onClick={() => setIsEditing(true)}
                    disabled={isPending}
                    size="sm"
                    variant="ghost"
                    className="h-10 touch-manipulation"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => onRemove(item.id)}
                    disabled={isPending}
                    size="sm"
                    variant="ghost"
                    className="h-10 touch-manipulation text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Helper: getStatusIcon (standalone for item card)
// ============================================================

function getStatusIcon(status: string) {
  switch (status) {
    case "IN_PROGRESS":
      return <CircleDotIcon className="size-5 text-blue-600" />;
    case "DONE":
      return <CheckCircle2Icon className="size-5 text-emerald-600" />;
    case "SKIPPED":
      return <SkipForwardIcon className="size-5 text-orange-600" />;
    default:
      return <ClockIcon className="size-5 text-zinc-400" />;
  }
}
