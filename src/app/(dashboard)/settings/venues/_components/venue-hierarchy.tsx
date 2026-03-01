"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BuildingIcon,
  ChevronRightIcon,
  LinkIcon,
  UnlinkIcon,
  Loader2Icon,
  NetworkIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { setVenueParent } from "@/actions/multi-venue.actions";

// ============================================================
// Types
// ============================================================

interface ChildVenue {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
}

interface ParentVenueRef {
  id: string;
  name: string;
}

interface VenueWithHierarchy {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  parentVenueId: string | null;
  parentVenue: ParentVenueRef | null;
  childVenues: ChildVenue[];
  _count: { bookings: number; childVenues: number };
}

interface VenueHierarchyProps {
  venues: VenueWithHierarchy[];
}

// ============================================================
// VenueHierarchy Component
// ============================================================

export function VenueHierarchy({ venues }: VenueHierarchyProps) {
  const router = useRouter();
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [selectedVenueId, setSelectedVenueId] = React.useState("");
  const [selectedParentId, setSelectedParentId] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [detachingId, setDetachingId] = React.useState<string | null>(null);

  // Separate parent venues (no parent themselves) and standalone venues
  const parentVenues = venues.filter(
    (v) => !v.parentVenueId && v.childVenues.length > 0
  );
  const standaloneVenues = venues.filter(
    (v) => !v.parentVenueId && v.childVenues.length === 0
  );
  const childVenuesList = venues.filter((v) => v.parentVenueId !== null);

  // For the assign dialog: venues that can be parents (no parent of their own)
  const potentialParents = venues.filter(
    (v) => !v.parentVenueId && v.id !== selectedVenueId
  );

  // For the assign dialog: venues that can be children (not already a parent with children, not the selected parent)
  const potentialChildren = venues.filter(
    (v) =>
      !v.parentVenueId &&
      v.childVenues.length === 0
  );

  function openAssignDialog() {
    setSelectedVenueId("");
    setSelectedParentId("");
    setAssignDialogOpen(true);
  }

  async function handleAssign() {
    if (!selectedVenueId || !selectedParentId) {
      toast.error("Select both a venue and a parent venue");
      return;
    }

    setIsPending(true);
    try {
      const result = await setVenueParent(selectedVenueId, selectedParentId);
      if (result.success) {
        toast.success("Venue assigned to parent successfully");
        setAssignDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to assign venue");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDetach(venueId: string) {
    setDetachingId(venueId);
    try {
      const result = await setVenueParent(venueId, null);
      if (result.success) {
        toast.success("Venue detached from parent");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to detach venue");
    } finally {
      setDetachingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NetworkIcon className="size-5 text-indigo-600" />
          <h3 className="text-lg font-semibold">Venue Hierarchy</h3>
        </div>
        <Button onClick={openAssignDialog} size="sm">
          <LinkIcon className="mr-2 size-4" />
          Assign Child Venue
        </Button>
      </div>

      {/* Hierarchical Venue Groups */}
      {parentVenues.length > 0 ? (
        <div className="space-y-4">
          {parentVenues.map((parent) => (
            <Card key={parent.id} className="border-indigo-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="size-5 text-indigo-600" />
                    <div>
                      <CardTitle className="text-base">{parent.name}</CardTitle>
                      <CardDescription>
                        {parent._count.childVenues} sub-venue
                        {parent._count.childVenues !== 1 ? "s" : ""} | Capacity:{" "}
                        {parent.capacity}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-indigo-50 text-indigo-700 border-indigo-200"
                  >
                    Parent Venue
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {parent.childVenues.length > 0 ? (
                  <div className="space-y-2 ml-6 border-l-2 border-indigo-100 pl-4">
                    {parent.childVenues.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between rounded-lg border p-3 bg-zinc-50"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronRightIcon className="size-4 text-zinc-400" />
                          <div>
                            <p className="text-sm font-medium">{child.name}</p>
                            <p className="text-xs text-zinc-500">
                              Capacity: {child.capacity}
                            </p>
                          </div>
                          {!child.isActive && (
                            <Badge
                              variant="outline"
                              className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]"
                            >
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDetach(child.id)}
                          disabled={detachingId === child.id}
                          className="text-zinc-500 hover:text-red-600"
                        >
                          {detachingId === child.id ? (
                            <Loader2Icon className="size-4 animate-spin" />
                          ) : (
                            <UnlinkIcon className="size-4" />
                          )}
                          <span className="ml-1.5 text-xs">Detach</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 ml-6">
                    No child venues assigned yet.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <NetworkIcon className="mx-auto mb-3 size-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No venue groups configured yet. Assign child venues to parent
              venues to create a hierarchy.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Child Venues (assigned to parents) — for reference */}
      {childVenuesList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-600">
              Assigned Child Venues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {childVenuesList.map((venue) => (
                <div
                  key={venue.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRightIcon className="size-4 text-zinc-400" />
                    <div>
                      <p className="text-sm font-medium">{venue.name}</p>
                      <p className="text-xs text-zinc-500">
                        Parent: {venue.parentVenue?.name || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDetach(venue.id)}
                    disabled={detachingId === venue.id}
                    className="text-zinc-500 hover:text-red-600"
                  >
                    {detachingId === venue.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <UnlinkIcon className="size-4" />
                    )}
                    <span className="ml-1.5 text-xs">Detach</span>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standalone Venues */}
      {standaloneVenues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-600">
              Standalone Venues ({standaloneVenues.length})
            </CardTitle>
            <CardDescription>
              These venues are not part of any hierarchy group.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {standaloneVenues.map((venue) => (
                <Badge
                  key={venue.id}
                  variant="outline"
                  className="py-1.5 px-3 text-xs"
                >
                  <BuildingIcon className="mr-1.5 size-3" />
                  {venue.name}
                  {!venue.isActive && (
                    <span className="ml-1 text-zinc-400">(Inactive)</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Venue to Parent</DialogTitle>
            <DialogDescription>
              Select a venue to assign as a child of a parent venue. This
              creates a hierarchical relationship for multi-venue coordination.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Child Venue</Label>
              <Select
                value={selectedVenueId}
                onValueChange={setSelectedVenueId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select venue to assign..." />
                </SelectTrigger>
                <SelectContent>
                  {potentialChildren.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name} (Cap: {venue.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parent Venue</Label>
              <Select
                value={selectedParentId}
                onValueChange={setSelectedParentId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select parent venue..." />
                </SelectTrigger>
                <SelectContent>
                  {potentialParents
                    .filter((v) => v.id !== selectedVenueId)
                    .map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name} (Cap: {venue.capacity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isPending || !selectedVenueId || !selectedParentId}
            >
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
