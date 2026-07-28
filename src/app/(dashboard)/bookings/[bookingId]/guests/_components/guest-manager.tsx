"use client";

import React, { useState, useTransition, useMemo, useCallback } from "react";
import {
  UsersIcon,
  UserCheckIcon,
  MailCheckIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
  TrashIcon,
  PencilIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2,
  PhoneIcon,
  MailIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  RSVP_STATUS_COLORS,
  GUEST_CATEGORY_LABELS,
} from "@/lib/constants";

import {
  createGuestList,
  checkInGuest,
  updateRSVP,
  removeGuest,
  bulkImportGuests,
} from "@/actions/guest.actions";
import { sendGuestInvitation } from "@/actions/invitation.actions";
import { AddGuestDialog } from "./add-guest-dialog";
import { InvitationDialog } from "./invitation-dialog";
import { InvitationStatusBadge } from "./invitation-status-badge";
import { ReminderSchedule } from "./reminder-schedule";

// ============================================================
// Types
// ============================================================

type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string;
  tableAssignment: string | null;
  rsvpStatus: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  plusOnes: number;
  dietaryRestrictions: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  guestListId: string;
  invitation?: {
    id: string;
    invitationStatus: string;
    sentAt: string | null;
    rsvpRespondedAt: string | null;
  } | null;
};

type GuestList = {
  id: string;
  totalInvited: number;
  totalRSVP: number;
  totalCheckedIn: number;
  bookingId: string;
  guests: Guest[];
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// Category Colors for Badges
// ============================================================

const GUEST_CATEGORY_COLORS: Record<string, string> = {
  VIP: "bg-amber-100 text-amber-800 border-amber-200",
  FAMILY: "bg-purple-100 text-purple-800 border-purple-200",
  FRIEND: "bg-blue-100 text-blue-800 border-blue-200",
  CORPORATE: "bg-slate-100 text-slate-800 border-slate-200",
  OTHER: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

// ============================================================
// CreateGuestListButton (exported for the server page)
// ============================================================

export function CreateGuestListButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createGuestList(bookingId);
      if (result.success) {
        toast.success("Guest list created successfully");
      } else {
        toast.error("Failed to create guest list", {
          description: result.error,
        });
      }
    });
  };

  return (
    <Button
      className="mt-6 bg-indigo-600 text-white hover:bg-indigo-700"
      onClick={handleCreate}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Creating...
        </>
      ) : (
        <>
          <PlusIcon className="mr-2 size-4" />
          Create Guest List
        </>
      )}
    </Button>
  );
}

// ============================================================
// GuestManager Component
// ============================================================

interface GuestManagerProps {
  bookingId: string;
  guestList: GuestList;
}

export function GuestManager({ bookingId, guestList }: GuestManagerProps) {
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [rsvpFilter, setRsvpFilter] = useState("ALL");

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [invitationMode, setInvitationMode] = useState<"single" | "bulk">("single");
  const [invitationGuests, setInvitationGuests] = useState<Guest[]>([]);

  // Bulk import state
  const [bulkText, setBulkText] = useState("");

  // ============================================================
  // Computed Data
  // ============================================================

  const guests = guestList.guests;

  const stats = useMemo(() => {
    const totalGuests = guests.length;
    const totalInvited = guests.reduce((sum, g) => sum + 1 + g.plusOnes, 0);
    const totalRSVP = guests.filter((g) => g.rsvpStatus === "ACCEPTED").length;
    const totalDeclined = guests.filter((g) => g.rsvpStatus === "DECLINED").length;
    const totalCheckedIn = guests.filter((g) => g.isCheckedIn).length;

    const byCategory: Record<string, number> = {};
    for (const guest of guests) {
      byCategory[guest.category] = (byCategory[guest.category] ?? 0) + 1;
    }

    return {
      totalGuests,
      totalInvited,
      totalRSVP,
      totalDeclined,
      totalCheckedIn,
      byCategory,
      rsvpPercent: totalGuests > 0 ? Math.round((totalRSVP / totalGuests) * 100) : 0,
      checkInPercent: totalGuests > 0 ? Math.round((totalCheckedIn / totalGuests) * 100) : 0,
    };
  }, [guests]);

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const matchesSearch =
        !search ||
        guest.name.toLowerCase().includes(search.toLowerCase()) ||
        guest.email?.toLowerCase().includes(search.toLowerCase()) ||
        guest.phone?.includes(search) ||
        guest.tableAssignment?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        categoryFilter === "ALL" || guest.category === categoryFilter;

      const matchesRsvp =
        rsvpFilter === "ALL" || guest.rsvpStatus === rsvpFilter;

      return matchesSearch && matchesCategory && matchesRsvp;
    });
  }, [guests, search, categoryFilter, rsvpFilter]);

  // ============================================================
  // Actions
  // ============================================================

  const handleCheckIn = useCallback(
    (guestId: string) => {
      startTransition(async () => {
        const result = await checkInGuest(guestId);
        if (result.success) {
          const checked = result.data.isCheckedIn;
          toast.success(
            checked ? "Guest checked in" : "Check-in removed"
          );
        } else {
          toast.error("Failed to update check-in", {
            description: result.error,
          });
        }
      });
    },
    []
  );

  const handleRSVPChange = useCallback(
    (guestId: string, status: string) => {
      startTransition(async () => {
        const result = await updateRSVP(guestId, {
          rsvpStatus: status as "PENDING" | "ACCEPTED" | "DECLINED",
        });
        if (result.success) {
          toast.success("RSVP status updated");
        } else {
          toast.error("Failed to update RSVP", {
            description: result.error,
          });
        }
      });
    },
    []
  );

  const handleDelete = useCallback(() => {
    if (!deletingGuest) return;
    startTransition(async () => {
      const result = await removeGuest(deletingGuest.id);
      if (result.success) {
        toast.success("Guest removed", {
          description: `${deletingGuest.name} has been removed from the guest list.`,
        });
        setDeleteDialogOpen(false);
        setDeletingGuest(null);
      } else {
        toast.error("Failed to remove guest", {
          description: result.error,
        });
      }
    });
  }, [deletingGuest]);

  const handleBulkImport = useCallback(() => {
    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast.error("No data to import", {
        description: "Please enter guest data, one per line.",
      });
      return;
    }

    const guestsToImport = lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        name: parts[0] || "",
        email: parts[1] || "",
        phone: parts[2] || "",
        category: (
          ["VIP", "FAMILY", "FRIEND", "CORPORATE", "OTHER"].includes(
            (parts[3] || "").toUpperCase()
          )
            ? (parts[3] || "").toUpperCase()
            : "OTHER"
        ) as "VIP" | "FAMILY" | "FRIEND" | "CORPORATE" | "OTHER",
        tableAssignment: parts[4] || "",
        plusOnes: parseInt(parts[5] || "0", 10) || 0,
      };
    });

    const validGuests = guestsToImport.filter((g) => g.name.length > 0);

    if (validGuests.length === 0) {
      toast.error("No valid guests found", {
        description: "Each line must have at least a guest name.",
      });
      return;
    }

    startTransition(async () => {
      const result = await bulkImportGuests(guestList.id, {
        guests: validGuests,
      });
      if (result.success) {
        toast.success(`${result.data.count} guests imported successfully`);
        setBulkImportOpen(false);
        setBulkText("");
      } else {
        toast.error("Failed to import guests", {
          description: result.error,
        });
      }
    });
  }, [bulkText, guestList.id]);

  const handleSendInvitation = useCallback((guest: Guest) => {
    setInvitationGuests([guest]);
    setInvitationMode("single");
    setInvitationDialogOpen(true);
  }, []);

  const handleSendAllInvitations = useCallback(() => {
    setInvitationGuests(guests);
    setInvitationMode("bulk");
    setInvitationDialogOpen(true);
  }, [guests]);

  const handleEditClick = useCallback((guest: Guest) => {
    setEditingGuest(guest);
    setEditDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback((guest: Guest) => {
    setDeletingGuest(guest);
    setDeleteDialogOpen(true);
  }, []);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Invited
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.totalInvited}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.totalGuests} guests + plus ones
                </p>
              </div>
              <div className="rounded-full bg-indigo-100 p-3 dark:bg-indigo-900/30">
                <UsersIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  RSVPs Accepted
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.totalRSVP}</p>
                <div className="mt-2">
                  <Progress value={stats.rsvpPercent} className="h-2" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.rsvpPercent}% response rate
                </p>
              </div>
              <div className="rounded-full bg-success/10 p-3">
                <MailCheckIcon className="size-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Checked In
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.totalCheckedIn}</p>
                <div className="mt-2">
                  <Progress value={stats.checkInPercent} className="h-2" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.checkInPercent}% of guests
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
                <UserCheckIcon className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                By Category
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(stats.byCategory).map(([cat, count]) => (
                  <Badge
                    key={cat}
                    variant="outline"
                    className={`border font-medium ${GUEST_CATEGORY_COLORS[cat] ?? ""}`}
                  >
                    {GUEST_CATEGORY_LABELS[cat] ?? cat}: {count}
                  </Badge>
                ))}
                {Object.keys(stats.byCategory).length === 0 && (
                  <p className="text-xs text-muted-foreground">No guests yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search guests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="FAMILY">Family</SelectItem>
              <SelectItem value="FRIEND">Friend</SelectItem>
              <SelectItem value="CORPORATE">Corporate</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rsvpFilter} onValueChange={setRsvpFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="RSVP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All RSVP</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="DECLINED">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSendAllInvitations}
            disabled={guests.length === 0}
          >
            <MailCheckIcon className="mr-2 size-4" />
            Send All Invitations
          </Button>
          <Button
            variant="outline"
            onClick={() => setBulkImportOpen(true)}
          >
            <UploadIcon className="mr-2 size-4" />
            Bulk Import
          </Button>
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => {
              setEditingGuest(null);
              setAddDialogOpen(true);
            }}
          >
            <PlusIcon className="mr-2 size-4" />
            Add Guest
          </Button>
        </div>
      </div>

      {/* Guest Table */}
      <Card>
        <CardContent className="p-0">
          {filteredGuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <UsersIcon className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {guests.length === 0
                  ? "No guests added yet. Start by adding a guest."
                  : "No guests match your filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Name</TableHead>
                    <TableHead className="min-w-[160px]">Contact</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Invitation</TableHead>
                    <TableHead>RSVP</TableHead>
                    <TableHead className="text-center">+Ones</TableHead>
                    <TableHead className="text-center">Check-in</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuests.map((guest) => (
                    <TableRow key={guest.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {guest.isCheckedIn && (
                            <CheckCircle2Icon className="size-4 shrink-0 text-success" />
                          )}
                          <div>
                            <p className="font-medium">{guest.name}</p>
                            {guest.dietaryRestrictions && (
                              <p className="text-xs text-muted-foreground">
                                Diet: {guest.dietaryRestrictions}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {guest.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MailIcon className="size-3" />
                              <span className="truncate max-w-[140px]">
                                {guest.email}
                              </span>
                            </div>
                          )}
                          {guest.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <PhoneIcon className="size-3" />
                              {guest.phone}
                            </div>
                          )}
                          {!guest.email && !guest.phone && (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={guest.category}
                          colorMap={GUEST_CATEGORY_COLORS}
                          label={GUEST_CATEGORY_LABELS[guest.category]}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {guest.tableAssignment || "--"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <InvitationStatusBadge
                          status={guest.invitation?.invitationStatus || null}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={guest.rsvpStatus}
                          onValueChange={(val) =>
                            handleRSVPChange(guest.id, val)
                          }
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="ACCEPTED">Accepted</SelectItem>
                            <SelectItem value="DECLINED">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {guest.plusOnes}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => handleCheckIn(guest.id)}
                          disabled={isPending}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors ${
                            guest.isCheckedIn
                              ? "border-success bg-success/10 text-success hover:bg-success/10"
                              : "border-border bg-card text-muted-foreground hover:border-success hover:bg-success/10 hover:text-success"
                          }`}
                          title={
                            guest.isCheckedIn
                              ? "Click to undo check-in"
                              : "Click to check in"
                          }
                        >
                          {guest.isCheckedIn ? (
                            <CheckCircle2Icon className="size-5" />
                          ) : (
                            <XCircleIcon className="size-5" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {guest.phone && (!guest.invitation || guest.invitation.invitationStatus === "NOT_SENT") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-indigo-500 hover:text-indigo-600"
                              onClick={() => handleSendInvitation(guest)}
                              title="Send Invitation"
                            >
                              <MailCheckIcon className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleEditClick(guest)}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(guest)}
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Guest Dialog */}
      <AddGuestDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        guestListId={guestList.id}
        editGuest={null}
      />

      {/* Edit Guest Dialog */}
      {editingGuest && (
        <AddGuestDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingGuest(null);
          }}
          guestListId={guestList.id}
          editGuest={editingGuest}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Guest</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">{deletingGuest?.name}</span> from
              the guest list? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingGuest(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invitation Dialog */}
      <InvitationDialog
        open={invitationDialogOpen}
        onOpenChange={setInvitationDialogOpen}
        bookingId={bookingId}
        guests={invitationGuests.map((g) => ({
          id: g.id,
          name: g.name,
          phone: g.phone,
          invitationStatus: g.invitation?.invitationStatus || null,
        }))}
        mode={invitationMode}
      />

      {/* Reminder Campaign */}
      <ReminderSchedule bookingId={bookingId} />

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Guests</DialogTitle>
            <DialogDescription>
              Paste guest data in CSV format. One guest per line with the format:
              Name, Email, Phone, Category, Table, PlusOnes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Example format:
              </p>
              <pre className="mt-1 text-xs text-muted-foreground">
{`John Smith, john@email.com, 9876543210, VIP, Table 1, 2
Jane Doe, jane@email.com, , FAMILY, Table 2, 1
Mike Wilson, , , FRIEND, , 0`}
              </pre>
            </div>
            <div className="space-y-2">
              <Label>Guest Data</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={10}
                placeholder="Paste CSV data here..."
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {bulkText.split("\n").filter((l) => l.trim()).length} rows
              detected
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkImportOpen(false);
                setBulkText("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleBulkImport}
              disabled={isPending || !bulkText.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 size-4" />
                  Import Guests
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
