"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from "date-fns";
import {
  CalendarIcon,
  ClockIcon,
  TagIcon,
  IndianRupeeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RESOURCE_TYPE_LABELS, BOOKING_STATUS_COLORS } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { deallocateResource } from "@/actions/resource.actions";

// ============================================================
// Types
// ============================================================

interface Allocation {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  createdAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    date: string;
    status: string;
  };
}

interface ResourceDetailData {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isAvailable: boolean;
  hourlyRate: number | null;
  createdAt: string;
  updatedAt: string;
  allocations: Allocation[];
}

interface ResourceDetailProps {
  resource: ResourceDetailData;
}

// ============================================================
// Deallocate Button
// ============================================================

function DeallocateButton({ allocationId }: { allocationId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleDeallocate = async () => {
    setIsPending(true);
    const result = await deallocateResource(allocationId);
    if (result.success) {
      toast.success("Allocation removed");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsPending(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-destructive">
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <TrashIcon className="size-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Allocation</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove this allocation? This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeallocate}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// Calendar Month View
// ============================================================

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarView({ allocations }: { allocations: Allocation[] }) {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getAllocationsForDay = (day: Date) => {
    return allocations.filter((a) => isSameDay(new Date(a.date), day));
  };

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold">
          {format(currentDate, "MMMM yyyy")}
        </h3>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <TooltipProvider>
        <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted">
          {/* Empty cells for days before month start */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] bg-background p-1" />
          ))}

          {/* Day cells */}
          {daysInMonth.map((day) => {
            const dayAllocations = getAllocationsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] bg-background p-1",
                  isToday && "bg-blue-50 dark:bg-blue-950/20"
                )}
              >
                <span
                  className={cn(
                    "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                    isToday &&
                      "bg-blue-600 text-white font-semibold"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="space-y-0.5">
                  {dayAllocations.slice(0, 2).map((alloc) => (
                    <Tooltip key={alloc.id}>
                      <TooltipTrigger asChild>
                        <div className="cursor-default truncate rounded bg-blue-100 px-1 py-0.5 text-meta font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          {alloc.startTime} {alloc.booking.eventName}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[250px]">
                        <p className="font-medium">
                          {alloc.booking.bookingNumber} -{" "}
                          {alloc.booking.eventName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alloc.startTime} - {alloc.endTime}
                        </p>
                        {alloc.notes && (
                          <p className="mt-1 text-xs">{alloc.notes}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {dayAllocations.length > 2 && (
                    <div className="text-meta text-muted-foreground pl-1">
                      +{dayAllocations.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

// ============================================================
// ResourceDetail Component
// ============================================================

export function ResourceDetail({ resource }: ResourceDetailProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="allocations">
          Allocations ({resource.allocations.length})
        </TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Resource Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resource Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <TagIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Type</p>
                  <Badge variant="secondary">
                    {RESOURCE_TYPE_LABELS[resource.type] ?? resource.type}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {resource.isAvailable ? (
                  <CheckCircleIcon className="size-4 text-green-600" />
                ) : (
                  <XCircleIcon className="size-4 text-red-500" />
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Availability</p>
                  <p className="text-sm">
                    {resource.isAvailable ? "Available" : "Unavailable"}
                  </p>
                </div>
              </div>
              {resource.hourlyRate !== null && (
                <div className="flex items-center gap-3">
                  <IndianRupeeIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Hourly Rate</p>
                    <p className="text-sm font-medium">
                      {formatINR(resource.hourlyRate)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="text-sm">{formatDate(resource.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats & Description Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Description & Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-2 text-xs">
                  Total Allocations
                </p>
                <p className="text-2xl font-bold">
                  {resource.allocations.length}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2 text-xs">
                  Description
                </p>
                {resource.description ? (
                  <p className="text-sm whitespace-pre-wrap">
                    {resource.description}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No description
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Allocations Tab */}
      <TabsContent value="allocations" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation History</CardTitle>
          </CardHeader>
          <CardContent>
            {resource.allocations.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No allocations yet.
              </p>
            ) : (
              <div className="space-y-3">
                {resource.allocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/bookings/${alloc.booking.id}`}
                        className="font-medium hover:underline"
                      >
                        {alloc.booking.bookingNumber} -{" "}
                        {alloc.booking.eventName}
                      </Link>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="size-3" />
                          {formatDate(alloc.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="size-3" />
                          {alloc.startTime} - {alloc.endTime}
                        </span>
                        {alloc.notes && (
                          <span className="italic">{alloc.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={alloc.booking.status}
                        colorMap={BOOKING_STATUS_COLORS}
                      />
                      <DeallocateButton allocationId={alloc.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Calendar Tab */}
      <TabsContent value="calendar" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarView allocations={resource.allocations} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
