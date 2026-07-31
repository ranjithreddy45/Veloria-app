"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  PlusIcon,
  Trash2Icon,
  ClockIcon,
  UserIcon,
  TruckIcon,
  SaveIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  BellIcon,
  PhoneIcon,
} from "lucide-react";

import {
  createOperation,
  updateOperation,
  updateRunOfShow,
  assignStaff,
  removeStaffAssignment,
  updateStaffStatus,
  assignVendor,
  removeVendorAssignment,
} from "@/actions/operations.actions";
import {
  confirmVendorAssignment,
  declineVendorAssignment,
  remindVendorAssignment,
} from "@/actions/vendor-assignment.actions";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Separator } from "@/components/ui/separator";
import {
  OPERATION_STATUS_COLORS,
  STAFF_ASSIGNMENT_STATUS_COLORS,
  VENDOR_CATEGORY_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { RunOfShowItem } from "@/schemas/operations.schema";

// ============================================================
// Local constants
// ============================================================

// Vendor assignment lifecycle colors (NOTIFIED→CONFIRMED/DECLINED). Kept local
// because the shared VENDOR_ASSIGNMENT_STATUS_COLORS map covers a different
// (PENDING/CONFIRMED/COMPLETED) vocabulary.
const VENDOR_ASSIGNMENT_LIFECYCLE_COLORS: Record<string, string> = {
  NOTIFIED:
    "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  CONFIRMED:
    "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  DECLINED:
    "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
};

// ============================================================
// Types
// ============================================================

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface StaffAssignmentData {
  id: string;
  role: string;
  shiftStart: string;
  shiftEnd: string;
  notes: string | null;
  status: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}

interface VendorAssignmentData {
  id: string;
  status?: string;
  arrivalTime: string | null;
  setupTime: string | null;
  teardownTime: string | null;
  notes: string | null;
  bookingVendor: {
    id: string;
    vendor: {
      id: string;
      name: string;
      category: string;
      phone: string | null;
      email: string | null;
    };
  };
}

interface BookingVendorData {
  id: string;
  role: string | null;
  status: string;
  vendor: {
    id: string;
    name: string;
    category: string;
    email: string | null;
    phone: string | null;
    rating: number;
  };
}

interface OperationData {
  id: string;
  status: string;
  runOfShow: RunOfShowItem[];
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  staffAssignments: StaffAssignmentData[];
  vendorAssignments: VendorAssignmentData[];
}

interface BookingInfo {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: string;
  timeSlot: string;
}

interface OperationsViewProps {
  booking: BookingInfo;
  operation: OperationData | null;
  staffUsers: StaffUser[];
  bookingVendors: BookingVendorData[];
}

// ============================================================
// Main Operations View Component
// ============================================================

export function OperationsView({
  booking,
  operation: initialOperation,
  staffUsers,
  bookingVendors,
}: OperationsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [operation, setOperation] = useState<OperationData | null>(
    initialOperation
  );

  // ----------------------------------------------------------
  // Create Operation
  // ----------------------------------------------------------

  function handleCreate() {
    startTransition(async () => {
      const result = await createOperation({ bookingId: booking.id });
      if (result.success && result.data) {
        setOperation(result.data as unknown as OperationData);
        toast.success("Operation plan created");
      } else {
        toast.error(result.error || "Failed to create operation");
      }
    });
  }

  // ----------------------------------------------------------
  // No operation yet — show create button
  // ----------------------------------------------------------

  if (!operation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="text-muted-foreground mb-4 text-center">
            <ClockIcon className="mx-auto mb-3 size-12 opacity-30" />
            <p className="text-lg font-medium">No Operation Plan Yet</p>
            <p className="mt-1 text-sm">
              Create an operation plan to manage run of show, staff assignments,
              and vendor coordination for this event.
            </p>
          </div>
          <Button onClick={handleCreate} disabled={isPending} className="mt-4">
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            <PlusIcon className="mr-2 size-4" />
            Create Operation Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ----------------------------------------------------------
  // Operation exists — render tabbed interface
  // ----------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Status & Notes Card */}
      <OperationStatusCard
        operation={operation}
        setOperation={setOperation}
      />

      {/* Tabbed Content */}
      <Tabs defaultValue="run-of-show">
        {/* Icon + label triggers are ~600px together; `inline-flex w-fit` made
            the page itself scroll sideways. Contain the overflow in the strip. */}
        <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="run-of-show">
            <ClockIcon className="mr-1.5 size-4" />
            Run of Show
          </TabsTrigger>
          <TabsTrigger value="staff">
            <UserIcon className="mr-1.5 size-4" />
            Staff ({operation.staffAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="vendors">
            <TruckIcon className="mr-1.5 size-4" />
            Vendors ({operation.vendorAssignments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="run-of-show" className="mt-6">
          <RunOfShowTab
            operationId={operation.id}
            items={operation.runOfShow}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-6">
          <StaffTab
            operationId={operation.id}
            assignments={operation.staffAssignments}
            staffUsers={staffUsers}
          />
        </TabsContent>

        <TabsContent value="vendors" className="mt-6">
          <VendorsTab
            operationId={operation.id}
            assignments={operation.vendorAssignments}
            bookingVendors={bookingVendors}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Operation Status Card
// ============================================================

function OperationStatusCard({
  operation,
  setOperation,
}: {
  operation: OperationData;
  setOperation: (op: OperationData) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(operation.internalNotes || "");

  function handleStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateOperation(operation.id, { status: status as "PLANNING" | "READY" | "LIVE" | "COMPLETED" });
      if (result.success && result.data) {
        setOperation({ ...operation, status: result.data.status });
        toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      const result = await updateOperation(operation.id, {
        internalNotes: notes,
      });
      if (result.success) {
        setOperation({ ...operation, internalNotes: notes });
        toast.success("Notes saved");
      } else {
        toast.error(result.error || "Failed to save notes");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Operation Status</span>
          <StatusBadge
            status={operation.status}
            colorMap={OPERATION_STATUS_COLORS}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="mb-1.5">Update Status</Label>
            <Select
              value={operation.status}
              onValueChange={handleStatusChange}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANNING">Planning</SelectItem>
                <SelectItem value="READY">Ready</SelectItem>
                <SelectItem value="LIVE">Live</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-muted-foreground text-xs">
            Created {formatDate(operation.createdAt)} by{" "}
            {operation.createdBy.name || operation.createdBy.email}
          </div>
        </div>

        <Separator />

        <div>
          <Label className="mb-1.5">Internal Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this operation..."
            rows={3}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveNotes}
            disabled={isPending}
            className="mt-2"
          >
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            <SaveIcon className="mr-2 size-4" />
            Save Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Run of Show Tab
// ============================================================

function RunOfShowTab({
  operationId,
  items: initialItems,
}: {
  operationId: string;
  items: RunOfShowItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<RunOfShowItem[]>(
    initialItems.length > 0 ? initialItems : []
  );

  function addItem() {
    setItems([...items, { time: "", activity: "", notes: "", assignee: "" }]);
  }

  function updateItem(index: number, field: keyof RunOfShowItem, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function handleSave() {
    // Filter out completely empty items
    const validItems = items.filter(
      (item) => item.time.trim() || item.activity.trim()
    );
    startTransition(async () => {
      const result = await updateRunOfShow(operationId, {
        items: validItems,
      });
      if (result.success) {
        setItems(validItems);
        toast.success("Run of show saved");
      } else {
        toast.error(result.error || "Failed to save run of show");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Run of Show</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addItem}>
            <PlusIcon className="mr-1.5 size-4" />
            Add Item
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            <SaveIcon className="mr-1.5 size-4" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No run of show items yet. Click "Add Item" to start building your
            timeline.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Header Row */}
            <div className="hidden gap-3 sm:grid sm:grid-cols-[120px_1fr_1fr_150px_40px]">
              <Label className="text-xs font-medium text-muted-foreground">Time</Label>
              <Label className="text-xs font-medium text-muted-foreground">Activity</Label>
              <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
              <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
              <div />
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[120px_1fr_1fr_150px_40px] sm:gap-3 sm:border-0 sm:p-0"
              >
                <div>
                  <Label className="mb-1 text-xs sm:hidden">Time</Label>
                  <Input
                    value={item.time}
                    onChange={(e) => updateItem(index, "time", e.target.value)}
                    placeholder="e.g. 10:00 AM"
                  />
                </div>
                <div>
                  <Label className="mb-1 text-xs sm:hidden">Activity</Label>
                  <Input
                    value={item.activity}
                    onChange={(e) =>
                      updateItem(index, "activity", e.target.value)
                    }
                    placeholder="Activity description"
                  />
                </div>
                <div>
                  <Label className="mb-1 text-xs sm:hidden">Notes</Label>
                  <Input
                    value={item.notes || ""}
                    onChange={(e) => updateItem(index, "notes", e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                <div>
                  <Label className="mb-1 text-xs sm:hidden">Assignee</Label>
                  <Input
                    value={item.assignee || ""}
                    onChange={(e) =>
                      updateItem(index, "assignee", e.target.value)
                    }
                    placeholder="Assignee"
                  />
                </div>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Staff Tab
// ============================================================

function StaffTab({
  operationId,
  assignments,
  staffUsers,
}: {
  operationId: string;
  assignments: StaffAssignmentData[];
  staffUsers: StaffUser[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [staffNotes, setStaffNotes] = useState("");

  function resetForm() {
    setSelectedUserId("");
    setRole("");
    setShiftStart("");
    setShiftEnd("");
    setStaffNotes("");
  }

  function handleAssign() {
    if (!selectedUserId || !role || !shiftStart || !shiftEnd) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await assignStaff(operationId, {
        userId: selectedUserId,
        role,
        shiftStart: new Date(shiftStart),
        shiftEnd: new Date(shiftEnd),
        notes: staffNotes,
      });
      if (result.success) {
        toast.success("Staff member assigned");
        setDialogOpen(false);
        resetForm();
      } else {
        toast.error(result.error || "Failed to assign staff");
      }
    });
  }

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      const result = await removeStaffAssignment(assignmentId);
      if (result.success) {
        toast.success("Staff assignment removed");
      } else {
        toast.error(result.error || "Failed to remove assignment");
      }
    });
  }

  function handleStatusChange(assignmentId: string, status: string) {
    startTransition(async () => {
      const result = await updateStaffStatus(assignmentId, {
        status: status as "ASSIGNED" | "CONFIRMED" | "CHECKED_IN",
      });
      if (result.success) {
        toast.success("Status updated");
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Staff Assignments</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusIcon className="mr-1.5 size-4" />
              Assign Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Staff Member</DialogTitle>
              <DialogDescription>
                Assign a staff member or event coordinator to this operation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5">Staff Member *</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email} ({user.role.replace(/_/g, " ")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">Role *</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Floor Manager, Sound Engineer"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Shift Start *</Label>
                  <Input
                    type="datetime-local"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Shift End *</Label>
                  <Input
                    type="datetime-local"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Notes</Label>
                <Textarea
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="Optional notes"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={isPending}>
                {isPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No staff assigned yet. Click "Assign Staff" to add team members.
          </p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {assignment.user.name || assignment.user.email}
                    </p>
                    <StatusBadge
                      status={assignment.status}
                      colorMap={STAFF_ASSIGNMENT_STATUS_COLORS}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Role: {assignment.role}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Shift:{" "}
                    {format(new Date(assignment.shiftStart), "dd MMM, hh:mm a")}{" "}
                    -{" "}
                    {format(new Date(assignment.shiftEnd), "dd MMM, hh:mm a")}
                  </p>
                  {assignment.notes && (
                    <p className="text-muted-foreground text-xs">
                      Notes: {assignment.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={assignment.status}
                    onValueChange={(val) =>
                      handleStatusChange(assignment.id, val)
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-[140px]" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASSIGNED">Assigned</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(assignment.id)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Vendors Tab
// ============================================================

function VendorsTab({
  operationId,
  assignments,
  bookingVendors,
}: {
  operationId: string;
  assignments: VendorAssignmentData[];
  bookingVendors: BookingVendorData[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedBookingVendorId, setSelectedBookingVendorId] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [setupTime, setSetupTime] = useState("");
  const [teardownTime, setTeardownTime] = useState("");
  const [vendorNotes, setVendorNotes] = useState("");

  // Filter out already-assigned booking vendors
  const assignedBookingVendorIds = new Set(
    assignments.map((a) => a.bookingVendor.id)
  );
  const availableVendors = bookingVendors.filter(
    (bv) => !assignedBookingVendorIds.has(bv.id)
  );

  function resetForm() {
    setSelectedBookingVendorId("");
    setArrivalTime("");
    setSetupTime("");
    setTeardownTime("");
    setVendorNotes("");
  }

  function handleAssign() {
    if (!selectedBookingVendorId) {
      toast.error("Please select a vendor");
      return;
    }

    startTransition(async () => {
      const result = await assignVendor(operationId, {
        bookingVendorId: selectedBookingVendorId,
        arrivalTime,
        setupTime,
        teardownTime,
        notes: vendorNotes,
      });
      if (result.success) {
        toast.success("Vendor assigned to operation");
        setDialogOpen(false);
        resetForm();
      } else {
        toast.error(result.error || "Failed to assign vendor");
      }
    });
  }

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      const result = await removeVendorAssignment(assignmentId);
      if (result.success) {
        toast.success("Vendor assignment removed");
      } else {
        toast.error(result.error || "Failed to remove assignment");
      }
    });
  }

  function handleConfirm(assignmentId: string) {
    startTransition(async () => {
      const result = await confirmVendorAssignment(assignmentId);
      if (result.success) {
        toast.success("Vendor confirmed");
      } else {
        toast.error(result.error || "Failed to confirm vendor");
      }
    });
  }

  function handleDecline(assignmentId: string) {
    const reason = window.prompt(
      "Reason for declining (optional):"
    );
    // A null return means the user cancelled the prompt — abort the action.
    if (reason === null) return;
    startTransition(async () => {
      const result = await declineVendorAssignment(
        assignmentId,
        reason.trim() || undefined
      );
      if (result.success) {
        toast.success("Vendor marked as declined");
      } else {
        toast.error(result.error || "Failed to decline vendor");
      }
    });
  }

  function handleRemind(assignmentId: string) {
    startTransition(async () => {
      const result = await remindVendorAssignment(assignmentId);
      if (result.success) {
        toast.success(
          result.data.sent
            ? "Reminder sent to vendor"
            : "Reminder recorded (no contact channel available)"
        );
      } else {
        toast.error(result.error || "Failed to send reminder");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Vendor Coordination</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={availableVendors.length === 0}
            >
              <PlusIcon className="mr-1.5 size-4" />
              Assign Vendor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Vendor to Operation</DialogTitle>
              <DialogDescription>
                Assign a booking vendor and set their arrival, setup, and
                teardown times.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5">Vendor *</Label>
                <Select
                  value={selectedBookingVendorId}
                  onValueChange={setSelectedBookingVendorId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVendors.map((bv) => (
                      <SelectItem key={bv.id} value={bv.id}>
                        {bv.vendor.name} (
                        {VENDOR_CATEGORY_LABELS[bv.vendor.category] ||
                          bv.vendor.category}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">Arrival Time</Label>
                <Input
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  placeholder="e.g. 8:00 AM"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Setup Time</Label>
                  <Input
                    value={setupTime}
                    onChange={(e) => setSetupTime(e.target.value)}
                    placeholder="e.g. 8:00 - 10:00 AM"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Teardown Time</Label>
                  <Input
                    value={teardownTime}
                    onChange={(e) => setTeardownTime(e.target.value)}
                    placeholder="e.g. 10:00 PM"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Notes</Label>
                <Textarea
                  value={vendorNotes}
                  onChange={(e) => setVendorNotes(e.target.value)}
                  placeholder="Optional coordination notes"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={isPending}>
                {isPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {bookingVendors.length === 0 ? (
              <p>
                No vendors assigned to this booking yet. Assign vendors in the
                booking details first.
              </p>
            ) : (
              <p>
                No vendors added to operations yet. Click "Assign Vendor" to
                coordinate vendor logistics.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {assignment.bookingVendor.vendor.name}
                    </p>
                    {assignment.status && (
                      <StatusBadge
                        status={assignment.status}
                        colorMap={VENDOR_ASSIGNMENT_LIFECYCLE_COLORS}
                      />
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {VENDOR_CATEGORY_LABELS[
                      assignment.bookingVendor.vendor.category
                    ] || assignment.bookingVendor.vendor.category}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                    {assignment.arrivalTime && (
                      <span>Arrival: {assignment.arrivalTime}</span>
                    )}
                    {assignment.setupTime && (
                      <span>Setup: {assignment.setupTime}</span>
                    )}
                    {assignment.teardownTime && (
                      <span>Teardown: {assignment.teardownTime}</span>
                    )}
                  </div>
                  {assignment.bookingVendor.vendor.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <span>Phone: {assignment.bookingVendor.vendor.phone}</span>
                      <a
                        href={`tel:${assignment.bookingVendor.vendor.phone}`}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-success transition-colors hover:bg-success/10 hover:text-success"
                      >
                        <PhoneIcon className="size-3" />
                        Call
                      </a>
                    </div>
                  )}
                  {assignment.notes && (
                    <p className="text-muted-foreground text-xs">
                      Notes: {assignment.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {assignment.status === "NOTIFIED" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfirm(assignment.id)}
                        disabled={isPending}
                        className="text-success hover:text-success"
                      >
                        <CheckIcon className="mr-1.5 size-4" />
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDecline(assignment.id)}
                        disabled={isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <XIcon className="mr-1.5 size-4" />
                        Decline
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemind(assignment.id)}
                        disabled={isPending}
                      >
                        <BellIcon className="mr-1.5 size-4" />
                        Remind
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="text-muted-foreground"
                    >
                      <BellIcon className="mr-1.5 size-4" />
                      Remind
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(assignment.id)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
