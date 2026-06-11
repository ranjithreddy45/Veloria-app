"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  UsersIcon,
  IndianRupeeIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createVenue, updateVenue } from "@/actions/booking.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface VenueData {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  pricePerSlot: unknown;
  amenities: string[];
  isActive: boolean;
  _count: { bookings: number };
}

interface VenuesListProps {
  venues: VenueData[];
}

// ============================================================
// VenuesList Component
// ============================================================

export function VenuesList({ venues }: VenuesListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingVenue, setEditingVenue] = React.useState<VenueData | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [capacity, setCapacity] = React.useState(0);
  const [pricePerSlot, setPricePerSlot] = React.useState(0);
  const [amenities, setAmenities] = React.useState("");

  function openCreateDialog() {
    setEditingVenue(null);
    setName("");
    setDescription("");
    setCapacity(0);
    setPricePerSlot(0);
    setAmenities("");
    setDialogOpen(true);
  }

  function openEditDialog(venue: VenueData) {
    setEditingVenue(venue);
    setName(venue.name);
    setDescription(venue.description || "");
    setCapacity(venue.capacity);
    setPricePerSlot(Number(venue.pricePerSlot));
    setAmenities(venue.amenities.join(", "));
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Venue name is required");
      return;
    }
    if (capacity <= 0) {
      toast.error("Capacity must be greater than 0");
      return;
    }

    setIsPending(true);
    try {
      const amenitiesArray = amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      if (editingVenue) {
        const result = await updateVenue(editingVenue.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          capacity,
          pricePerSlot,
          amenities: amenitiesArray,
        });
        if (result.success) {
          toast.success("Venue updated successfully");
          setDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createVenue({
          name: name.trim(),
          description: description.trim() || undefined,
          capacity,
          pricePerSlot,
          amenities: amenitiesArray,
        });
        if (result.success) {
          toast.success("Venue created successfully");
          setDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsPending(false);
    }
  }

  async function handleToggleActive(venue: VenueData) {
    try {
      const result = await updateVenue(venue.id, {
        isActive: !venue.isActive,
      });
      if (result.success) {
        toast.success(
          venue.isActive ? "Venue deactivated" : "Venue activated"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update venue");
    }
  }

  return (
    <>
      {/* Add Venue Button */}
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-2 size-4" />
          Add Venue
        </Button>
      </div>

      {/* Venues Grid */}
      {venues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No venues configured yet. Add your first venue to start managing
              bookings.
            </p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <PlusIcon className="mr-2 size-4" />
              Add Your First Venue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Card
              key={venue.id}
              className={!venue.isActive ? "opacity-60" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{venue.name}</CardTitle>
                    {venue.description && (
                      <p className="text-muted-foreground mt-1 text-xs line-clamp-2">
                        {venue.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {venue.isActive ? (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-700 border-green-200 text-[10px]"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]"
                      >
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="text-muted-foreground size-4" />
                    <div>
                      <p className="text-muted-foreground text-[10px]">
                        Capacity
                      </p>
                      <p className="text-sm font-medium">{venue.capacity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupeeIcon className="text-muted-foreground size-4" />
                    <div>
                      <p className="text-muted-foreground text-[10px]">
                        Price/Slot
                      </p>
                      <p className="text-sm font-medium">
                        {formatINR(venue.pricePerSlot)}
                      </p>
                    </div>
                  </div>
                </div>

                {venue.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {venue.amenities.map((amenity) => (
                      <Badge
                        key={amenity}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="text-muted-foreground text-xs">
                  {venue._count.bookings} booking
                  {venue._count.bookings !== 1 ? "s" : ""}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={venue.isActive}
                      onCheckedChange={() => handleToggleActive(venue)}
                    />
                    <span className="text-xs text-zinc-500">
                      {venue.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(venue)}
                  >
                    <PencilIcon className="mr-1.5 size-3" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingVenue ? "Edit Venue" : "Add New Venue"}
            </DialogTitle>
            <DialogDescription>
              {editingVenue
                ? "Update the venue details below."
                : "Fill in the details to add a new venue."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="venue-name">Name *</Label>
              <Input
                id="venue-name"
                placeholder="e.g., Grand Ballroom"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-description">Description</Label>
              <Textarea
                id="venue-description"
                placeholder="Describe the venue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="venue-capacity">Capacity *</Label>
                <Input
                  id="venue-capacity"
                  type="number"
                  min="1"
                  placeholder="e.g., 500"
                  value={capacity || ""}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-price">Price per Slot (INR) *</Label>
                <Input
                  id="venue-price"
                  type="number"
                  min="0"
                  placeholder="e.g., 100000"
                  value={pricePerSlot || ""}
                  onChange={(e) =>
                    setPricePerSlot(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-amenities">
                Amenities (comma-separated)
              </Label>
              <Input
                id="venue-amenities"
                placeholder="e.g., AC, Stage, Sound System, Parking"
                value={amenities}
                onChange={(e) => setAmenities(e.target.value)}
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
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              {editingVenue ? "Update Venue" : "Create Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
