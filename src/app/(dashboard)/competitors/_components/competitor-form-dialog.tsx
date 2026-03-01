"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, StarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import {
  createCompetitor,
  updateCompetitor,
} from "@/actions/competitor.actions";

// ============================================================
// Constants
// ============================================================

const VENUE_TYPE_OPTIONS = [
  "Wedding",
  "Corporate",
  "Social",
  "Birthday",
  "Reception",
  "Conference",
  "Exhibition",
  "Outdoor",
  "Banquet Hall",
  "Resort",
] as const;

const PRICE_RANGE_OPTIONS = [
  "Budget",
  "Economy",
  "Mid-Range",
  "Premium",
  "Luxury",
] as const;

// ============================================================
// Types
// ============================================================

interface CompetitorData {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
  venueTypes: string[];
  priceRange: string | null;
  rating: number | null;
  strengths: string | null;
  weaknesses: string | null;
  notes: string | null;
}

interface CompetitorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitor?: CompetitorData;
}

// ============================================================
// Star Rating Selector
// ============================================================

function StarRatingSelector({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (val: number | undefined) => void;
}) {
  const [hovered, setHovered] = React.useState(0);

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starVal = i + 1;
        const isFilled = hovered ? starVal <= hovered : starVal <= (value ?? 0);

        return (
          <button
            key={i}
            type="button"
            className="cursor-pointer transition-transform hover:scale-110"
            onClick={() => onChange(starVal === value ? undefined : starVal)}
            onMouseEnter={() => setHovered(starVal)}
          >
            <StarIcon
              className={cn(
                "size-6",
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-muted text-muted-foreground/30"
              )}
            />
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          className="ml-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange(undefined)}
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ============================================================
// CompetitorFormDialog Component
// ============================================================

export function CompetitorFormDialog({
  open,
  onOpenChange,
  competitor,
}: CompetitorFormDialogProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!competitor;

  // Form state
  const [name, setName] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [venueTypes, setVenueTypes] = React.useState<string[]>([]);
  const [priceRange, setPriceRange] = React.useState("");
  const [rating, setRating] = React.useState<number | undefined>(undefined);
  const [strengths, setStrengths] = React.useState("");
  const [weaknesses, setWeaknesses] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Reset form when dialog opens/competitor changes
  React.useEffect(() => {
    if (open) {
      setName(competitor?.name ?? "");
      setWebsite(competitor?.website ?? "");
      setLocation(competitor?.location ?? "");
      setVenueTypes(competitor?.venueTypes ?? []);
      setPriceRange(competitor?.priceRange ?? "");
      setRating(competitor?.rating ?? undefined);
      setStrengths(competitor?.strengths ?? "");
      setWeaknesses(competitor?.weaknesses ?? "");
      setNotes(competitor?.notes ?? "");
    }
  }, [open, competitor]);

  const handleVenueTypeToggle = (type: string) => {
    setVenueTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    try {
      const payload = {
        name,
        website: website || undefined,
        location: location || undefined,
        venueTypes,
        priceRange: priceRange || undefined,
        rating,
        strengths: strengths || undefined,
        weaknesses: weaknesses || undefined,
        notes: notes || undefined,
      };

      const result = isEditing
        ? await updateCompetitor(competitor.id, payload)
        : await createCompetitor(payload);

      if (result.success) {
        toast.success(
          isEditing
            ? "Competitor updated successfully"
            : "Competitor added successfully"
        );
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Competitor" : "Add Competitor"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update competitor details and analysis."
              : "Add a new competitor for tracking and comparison."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name & Website */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comp-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="comp-name"
                placeholder="e.g. Grand Palace Events"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-website">Website</Label>
              <Input
                id="comp-website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>

          {/* Location & Price Range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comp-location">Location</Label>
              <Input
                id="comp-location"
                placeholder="e.g. Mumbai, Maharashtra"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-price">Price Range</Label>
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger id="comp-price" className="w-full">
                  <SelectValue placeholder="Select price range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {PRICE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Rating</Label>
            <StarRatingSelector value={rating} onChange={setRating} />
          </div>

          {/* Venue Types */}
          <div className="space-y-2">
            <Label>Venue Types</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {VENUE_TYPE_OPTIONS.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={venueTypes.includes(type)}
                    onCheckedChange={() => handleVenueTypeToggle(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comp-strengths">Strengths</Label>
              <Textarea
                id="comp-strengths"
                placeholder="What they do well..."
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-weaknesses">Weaknesses</Label>
              <Textarea
                id="comp-weaknesses"
                placeholder="Where they fall short..."
                value={weaknesses}
                onChange={(e) => setWeaknesses(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="comp-notes">Notes</Label>
            <Textarea
              id="comp-notes"
              placeholder="Additional observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              {isEditing ? "Update Competitor" : "Add Competitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
