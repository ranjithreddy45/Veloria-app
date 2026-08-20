"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createGalleryItem } from "@/actions/gallery.actions";
import { MEDIA_TYPE_LABELS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

type Venue = {
  id: string;
  name: string;
};

interface AddGalleryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
}

// ============================================================
// Component
// ============================================================

export function AddGalleryItemDialog({
  open,
  onOpenChange,
  venues,
}: AddGalleryItemDialogProps) {
  const [isPending, startTransition] = useTransition();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState("PHOTO");
  const [url, setUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [venueId, setVenueId] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setMediaType("PHOTO");
    setUrl("");
    setThumbnailUrl("");
    setIsPublic(false);
    setVenueId("");
    setTagInput("");
    setTags([]);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().replace(",", "");
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter a valid URL");
      return;
    }

    startTransition(async () => {
      const result = await createGalleryItem({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        mediaType: mediaType as "PHOTO" | "VIDEO",
        url: url.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        tags,
        isPublic,
        order: 0,
        venueId: venueId || undefined,
      });

      if (result.success) {
        toast.success("Gallery item added", {
          description: title
            ? `"${title}" has been added to the gallery.`
            : "Item has been added to the gallery.",
        });
        resetForm();
        onOpenChange(false);
      } else {
        toast.error("Failed to add gallery item", {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Gallery Item</DialogTitle>
          <DialogDescription>
            Add a photo or video to your gallery by providing its URL.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL (required) */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">
              Media URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              required
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Wedding Ceremony Highlights"
              maxLength={200}
            />
          </div>

          {/* Media Type + Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="media-type" className="text-sm font-medium">
                Media Type
              </Label>
              <Select value={mediaType} onValueChange={setMediaType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHOTO">
                    {MEDIA_TYPE_LABELS.PHOTO}
                  </SelectItem>
                  <SelectItem value="VIDEO">
                    {MEDIA_TYPE_LABELS.VIDEO}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Visibility</Label>
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  id="is-public"
                />
                <Label
                  htmlFor="is-public"
                  className="cursor-pointer text-sm font-normal text-muted-foreground"
                >
                  {isPublic ? "Public" : "Private"}
                </Label>
              </div>
            </div>
          </div>

          {/* Thumbnail URL */}
          <div className="space-y-2">
            <Label htmlFor="thumbnail-url" className="text-sm font-medium">
              Thumbnail URL
            </Label>
            <Input
              id="thumbnail-url"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://example.com/thumbnail.jpg"
            />
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="venue" className="text-sm font-medium">
              Venue
            </Label>
            <Select
              value={venueId || "__none__"}
              onValueChange={(v) => setVenueId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select venue (optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add a description for this item..."
              maxLength={2000}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm font-medium">
              Tags
            </Label>
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type a tag and press Enter..."
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 rounded-full hover:bg-zinc-300/50"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Item"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
