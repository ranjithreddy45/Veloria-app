"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateGalleryItem } from "@/actions/gallery.actions";
import { customerAppVisibility } from "./gallery-visibility";

// ============================================================
// Team gallery → customer app. On an existing gallery item, staff choose
// whether customers see it (GalleryItem.isPublic) and which hall it belongs to
// (GalleryItem.venueId). The customer app reads exactly these fields — there
// is no separate customer copy. Saves through the existing updateGalleryItem
// action (gallery:update permission, uploader-or-admin guard, activity log).
//
// Mount: src/app/(dashboard)/gallery/_components/gallery-grid.tsx, inside each
// card's <CardContent>:
//   <GalleryVisibilityToggle item={item} venues={venues} />
// ============================================================

const NO_HALL = "__none__";

export interface GalleryVisibilityItem {
  id: string;
  isPublic: boolean;
  venueId: string | null;
  mediaType: string;
}

type Visibility = { isPublic: boolean; venueId: string | null };

export function GalleryVisibilityToggle({
  item,
  venues,
  className,
}: {
  item: GalleryVisibilityItem;
  venues: { id: string; name: string }[];
  className?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  // Shows the change at once; falls back to the saved values if the save fails.
  const [shown, showOptimistic] = React.useOptimistic<Visibility, Partial<Visibility>>(
    { isPublic: item.isPublic, venueId: item.venueId },
    (current, patch) => ({ ...current, ...patch })
  );

  function save(patch: Partial<Visibility>) {
    startTransition(async () => {
      showOptimistic(patch);
      const res = await updateGalleryItem(item.id, {
        ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
        ...(patch.venueId !== undefined ? { venueId: patch.venueId ?? "" } : {}),
      });
      if (res.success) {
        toast.success(patch.isPublic === undefined ? "Hall updated" : patch.isPublic ? "Now shown in the customer app" : "Hidden from the customer app");
      } else {
        toast.error("Couldn't update this item", { description: res.error });
      }
    });
  }

  const venueName = venues.find((v) => v.id === shown.venueId)?.name ?? null;
  const switchId = `gallery-public-${item.id}`;

  return (
    <div className={cn("mt-2 space-y-2 rounded-md border border-dashed border-zinc-200 p-2", className)} aria-busy={pending}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={switchId} className="text-xs font-medium">
          Show in customer app
        </Label>
        <Switch id={switchId} checked={shown.isPublic} disabled={pending} onCheckedChange={(v) => save({ isPublic: v })} />
      </div>
      <Select value={shown.venueId ?? NO_HALL} disabled={pending} onValueChange={(v) => save({ venueId: v === NO_HALL ? null : v })}>
        <SelectTrigger className="h-8 w-full text-xs" aria-label="Hall for this item">
          <SelectValue placeholder="Hall" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_HALL}>No hall (gallery only)</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs leading-snug text-muted-foreground">
        {customerAppVisibility({ isPublic: shown.isPublic, mediaType: item.mediaType, venueName })}
      </p>
    </div>
  );
}
