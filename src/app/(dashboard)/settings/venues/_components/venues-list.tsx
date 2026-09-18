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
  PercentIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { isCredibleSlotPrice } from "@/lib/pricing/credible-slot-price";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createVenue, updateVenue } from "@/actions/booking.actions";
import {
  PROPERTY_TYPES,
  defaultGstFor,
  propertyTypeLabel,
  propertyTypeOption,
} from "@/lib/sales/property-type";
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
  inHouseCateringRequired?: boolean;
  inHouseCateringNote?: string | null;
  /** Decides the GST rate. See src/lib/sales/property-type.ts. */
  propertyType?: string | null;
  taxSlabs?: {
    id: string;
    name: string;
    cgstRate: unknown;
    sgstRate: unknown;
    igstRate: unknown;
    isDefault: boolean;
  }[];
  _count: { bookings: number };
}

/** The rate this property will actually quote at: its default rate if one is
 *  configured, otherwise the standard rate for its type. */
function effectiveGst(venue: VenueData): { rate: number; configured: boolean } {
  const chosen = venue.taxSlabs?.find((t) => t.isDefault) ?? venue.taxSlabs?.[0];
  if (chosen) {
    return {
      rate: Number(chosen.cgstRate) + Number(chosen.sgstRate) + Number(chosen.igstRate),
      configured: true,
    };
  }
  return { rate: defaultGstFor(venue.propertyType), configured: false };
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
  const [inHouseCatering, setInHouseCatering] = React.useState(false);
  const [propertyType, setPropertyType] = React.useState("");
  const [inHouseNote, setInHouseNote] = React.useState("");

  function openCreateDialog() {
    setEditingVenue(null);
    setName("");
    setDescription("");
    setCapacity(0);
    setPricePerSlot(0);
    setAmenities("");
    setInHouseCatering(false);
    setPropertyType("");
    setInHouseNote("");
    setDialogOpen(true);
  }

  function openEditDialog(venue: VenueData) {
    setEditingVenue(venue);
    setName(venue.name);
    setDescription(venue.description || "");
    setCapacity(venue.capacity);
    setPricePerSlot(Number(venue.pricePerSlot));
    setAmenities(venue.amenities.join(", "));
    setInHouseCatering(venue.inHouseCateringRequired ?? false);
    setPropertyType(venue.propertyType ?? "");
    setInHouseNote(venue.inHouseCateringNote ?? "");
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
          inHouseCateringRequired: inHouseCatering,
          inHouseCateringNote: inHouseNote.trim(),
          propertyType,
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
          inHouseCateringRequired: inHouseCatering,
          inHouseCateringNote: inHouseNote.trim(),
          propertyType,
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
                        className="bg-success/15 text-success border-success/20 text-meta"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground border-border text-meta"
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
                      <p className="text-muted-foreground text-meta">
                        Capacity
                      </p>
                      <p className="text-sm font-medium">{venue.capacity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupeeIcon className="text-muted-foreground size-4" />
                    <div>
                      <p className="text-muted-foreground text-meta">
                        Price/Slot
                      </p>
                      <p className="text-sm font-medium">
                        {formatINR(venue.pricePerSlot)}
                      </p>
                      {!isCredibleSlotPrice(Number(venue.pricePerSlot)) && (
                        <p className="text-xs font-medium text-amber-600">
                          Placeholder — customers see &quot;Price on request&quot;
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PercentIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-meta">
                      {propertyTypeLabel(venue.propertyType)}
                    </p>
                    <p className="text-sm font-medium">
                      GST {effectiveGst(venue).rate}%
                      {!effectiveGst(venue).configured && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · standard for this type
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {venue.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {venue.amenities.map((amenity) => (
                      <Badge
                        key={amenity}
                        variant="secondary"
                        className="text-meta"
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
                    <span className="text-xs text-muted-foreground">
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
            {/* Property type — this is what decides the GST rate, so it sits
                with the commercial fields rather than the descriptive ones. */}
            <div className="space-y-2">
              <Label htmlFor="venue-property-type">Property type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger id="venue-property-type">
                  <SelectValue placeholder="Choose a type to set the GST rate" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — GST {t.defaultGst}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {propertyTypeOption(propertyType)?.hint ??
                  "A 4- or 5-star hotel charges 18%. Other venues charge 5% on a package that includes food."}
              </p>
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
            {/* In-house catering requirement (item 3) */}
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={inHouseCatering}
                  onChange={(e) => setInHouseCatering(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-medium">Requires in-house catering</span>
                  <span className="block text-xs text-muted-foreground">
                    Food must be bought from this hall&apos;s own caterer (e.g. HHI). Shows an
                    advisory on the quotation.
                  </span>
                </span>
              </label>
              {inHouseCatering && (
                <Input
                  placeholder="Note shown on quote (optional) — e.g. Catering by HHI only"
                  value={inHouseNote}
                  onChange={(e) => setInHouseNote(e.target.value)}
                />
              )}
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
