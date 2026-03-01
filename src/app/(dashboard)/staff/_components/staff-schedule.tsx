"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  PlusIcon,
  ClockIcon,
  Trash2Icon,
  CheckCircleIcon,
  XCircleIcon,
  LogInIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { SHIFT_STATUS_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  createShift,
  updateShift,
  deleteShift,
} from "@/actions/staff.actions";

// ============================================================
// Types
// ============================================================

interface StaffUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface StaffProfileBasic {
  id: string;
  user: StaffUser;
}

interface ShiftData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  status: string;
  hoursWorked: number | null;
  overtimeHours: number | null;
  staff: {
    id: string;
    user: StaffUser;
  };
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
  } | null;
}

interface StaffScheduleProps {
  shifts: ShiftData[];
  staffProfiles: StaffProfileBasic[];
}

// ============================================================
// Create Shift Dialog
// ============================================================

function CreateShiftDialog({
  staffProfiles,
}: {
  staffProfiles: StaffProfileBasic[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      staffId: formData.get("staffId") as string,
      date: new Date(formData.get("date") as string),
      startTime: formData.get("startTime") as string,
      endTime: formData.get("endTime") as string,
      role: formData.get("role") as string,
      bookingId: (formData.get("bookingId") as string) || "",
    };

    const result = await createShift(data);

    if (result.success) {
      toast.success("Shift created successfully");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="mr-2 size-4" />
          Add Shift
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Shift</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staffId">Staff Member</Label>
            <Select name="staffId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staffProfiles.map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.user.name || sp.user.email || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input type="date" name="date" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                type="time"
                name="startTime"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                type="time"
                name="endTime"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              name="role"
              placeholder="e.g. Event Coordinator, Server, DJ"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Shift"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Shift Card
// ============================================================

function ShiftCard({ shift }: { shift: ShiftData }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleStatusChange = async (status: string) => {
    setLoading(true);
    const updateData: Record<string, unknown> = { status };

    // Auto-calculate hours worked when completing a shift
    if (status === "COMPLETED") {
      const [startH, startM] = shift.startTime.split(":").map(Number);
      const [endH, endM] = shift.endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const totalMinutes = endMinutes > startMinutes
        ? endMinutes - startMinutes
        : (24 * 60 - startMinutes) + endMinutes;
      const hours = totalMinutes / 60;
      const regularHours = Math.min(hours, 8);
      const overtime = Math.max(0, hours - 8);
      updateData.hoursWorked = Number(regularHours.toFixed(2));
      updateData.overtimeHours = Number(overtime.toFixed(2));
    }

    const result = await updateShift(shift.id, updateData);
    if (result.success) {
      toast.success(`Shift marked as ${status.toLowerCase().replace("_", " ")}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    const result = await deleteShift(shift.id);
    if (result.success) {
      toast.success("Shift deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {shift.staff.user.name || "Unknown Staff"}
              </span>
              <StatusBadge
                status={shift.status}
                colorMap={SHIFT_STATUS_COLORS}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              <ClockIcon className="mr-1 inline-block size-3.5" />
              {shift.startTime} - {shift.endTime}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Role:</span>{" "}
              {shift.role}
            </p>
            {shift.booking && (
              <p className="text-xs text-muted-foreground">
                Booking: {shift.booking.bookingNumber} - {shift.booking.eventName}
              </p>
            )}
            {shift.hoursWorked != null && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Hours: {shift.hoursWorked}h</span>
                {shift.overtimeHours != null && shift.overtimeHours > 0 && (
                  <span className="text-amber-600">
                    OT: {shift.overtimeHours}h
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {shift.status === "SCHEDULED" && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleStatusChange("CHECKED_IN")}
                disabled={loading}
                title="Check In"
              >
                <LogInIcon className="size-4 text-blue-600" />
              </Button>
            )}
            {shift.status === "CHECKED_IN" && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleStatusChange("COMPLETED")}
                disabled={loading}
                title="Mark Completed"
              >
                <CheckCircleIcon className="size-4 text-green-600" />
              </Button>
            )}
            {(shift.status === "SCHEDULED" || shift.status === "CHECKED_IN") && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleStatusChange("ABSENT")}
                disabled={loading}
                title="Mark Absent"
              >
                <XCircleIcon className="size-4 text-red-600" />
              </Button>
            )}
            {shift.status === "SCHEDULED" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-xs" title="Delete">
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Shift</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this shift for{" "}
                      <span className="font-medium">
                        {shift.staff.user.name}
                      </span>
                      ? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Staff Schedule Component
// ============================================================

export function StaffSchedule({ shifts, staffProfiles }: StaffScheduleProps) {
  const [filterStaffId, setFilterStaffId] = React.useState<string>("all");

  // Group shifts by date
  const filteredShifts =
    filterStaffId === "all"
      ? shifts
      : shifts.filter((s) => s.staff.id === filterStaffId);

  const groupedByDate = filteredShifts.reduce<Record<string, ShiftData[]>>(
    (acc, shift) => {
      const dateKey = shift.date.split("T")[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(shift);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterStaffId} onValueChange={setFilterStaffId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffProfiles.map((sp) => (
                <SelectItem key={sp.id} value={sp.id}>
                  {sp.user.name || sp.user.email || "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {filteredShifts.length} shift{filteredShifts.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        <CreateShiftDialog staffProfiles={staffProfiles} />
      </div>

      {/* Schedule Grid */}
      {sortedDates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ClockIcon className="mx-auto size-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-semibold">No shifts found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new shift to get started with scheduling.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {formatDate(date)}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupedByDate[date].map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
