"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  MapPinIcon,
  UtensilsIcon,
} from "lucide-react";
import { format } from "date-fns";

import { createTasting, updateTasting } from "@/actions/tasting.actions";
import type { CreateTastingInput } from "@/schemas/tasting.schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface SelectedItem {
  name: string;
  category?: string;
  notes?: string;
}

interface Venue {
  id: string;
  name: string;
}

interface SerializedTasting {
  id: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  selectedItems: SelectedItem[] | null;
  notes: string | null;
  feedback: string | null;
  contactId: string;
  venueId: string | null;
  bookingId: string;
}

interface TastingFormProps {
  bookingId: string;
  contactId: string;
  venues: Venue[];
  tasting?: SerializedTasting | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ============================================================
// Time Slot Options
// ============================================================

const TIME_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
  "05:30 PM",
  "06:00 PM",
  "06:30 PM",
  "07:00 PM",
];

const MENU_CATEGORIES = [
  "Starters",
  "Main Course",
  "Desserts",
  "Beverages",
  "Live Counters",
  "Salads",
  "Breads",
  "Rice & Biryani",
  "Accompaniments",
];

// ============================================================
// TastingForm Component
// ============================================================

export function TastingForm({
  bookingId,
  contactId,
  venues,
  tasting,
  onSuccess,
  onCancel,
}: TastingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!tasting;

  // Form state
  const [date, setDate] = useState<Date | undefined>(
    tasting?.scheduledDate ? new Date(tasting.scheduledDate) : undefined
  );
  const [time, setTime] = useState(tasting?.scheduledTime ?? "");
  const [venueId, setVenueId] = useState(tasting?.venueId ?? "");
  const [notes, setNotes] = useState(tasting?.notes ?? "");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(
    (tasting?.selectedItems as SelectedItem[]) ?? []
  );

  // New item state
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");

  function addItem() {
    if (!newItemName.trim()) {
      toast.error("Item name is required");
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        name: newItemName.trim(),
        category: newItemCategory,
        notes: newItemNotes.trim(),
      },
    ]);
    setNewItemName("");
    setNewItemCategory("");
    setNewItemNotes("");
  }

  function removeItem(index: number) {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (!date) {
      toast.error("Please select a date");
      return;
    }
    if (!time) {
      toast.error("Please select a time");
      return;
    }

    startTransition(async () => {
      const payload: CreateTastingInput = {
        scheduledDate: date.toISOString(),
        scheduledTime: time,
        contactId,
        venueId: venueId || "",
        notes: notes || "",
        selectedItems,
      };

      const result = isEditing
        ? await updateTasting(tasting!.id, {
            scheduledDate: payload.scheduledDate,
            scheduledTime: payload.scheduledTime,
            venueId: payload.venueId,
            notes: payload.notes,
            selectedItems: payload.selectedItems,
          })
        : await createTasting(bookingId, payload);

      if (result.success) {
        toast.success(
          isEditing
            ? "Tasting updated successfully"
            : "Tasting scheduled successfully"
        );
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.error || "Something went wrong");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isEditing ? "Edit Tasting" : "Schedule New Tasting"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date & Time Row */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>
              Date <span className="text-red-500">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Select */}
          <div className="space-y-2">
            <Label>
              Time <span className="text-red-500">*</span>
            </Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <ClockIcon className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Select time" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Venue */}
        {venues.length > 0 && (
          <div className="space-y-2">
            <Label>Venue</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Select venue (optional)" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No venue</SelectItem>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions or dietary requirements..."
            rows={3}
          />
        </div>

        {/* Menu Items Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UtensilsIcon className="size-4 text-muted-foreground" />
            <Label className="text-sm font-medium">
              Menu Items to Taste ({selectedItems.length})
            </Label>
          </div>

          {/* Existing Items */}
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              {selectedItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.category && (
                        <span className="text-xs text-muted-foreground">
                          {item.category}
                        </span>
                      )}
                      {item.notes && (
                        <span className="text-xs text-muted-foreground">
                          - {item.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-red-500 hover:text-red-700"
                    onClick={() => removeItem(index)}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Item */}
          <div className="rounded-lg border border-dashed p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Add Menu Item
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Item name *"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {MENU_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Item notes"
                value={newItemNotes}
                onChange={(e) => setNewItemNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
            >
              <PlusIcon className="mr-2 size-4" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Tasting" : "Schedule Tasting"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
