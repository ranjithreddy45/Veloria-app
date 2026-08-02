"use client";

import React, { useState, useTransition, useMemo } from "react";
import Image from "next/image";
import {
  ImageIcon,
  VideoIcon,
  TrashIcon,
  GlobeIcon,
  LockIcon,
  SearchIcon,
  FilterIcon,
  PlusIcon,
  XIcon,
  MoreHorizontalIcon,
  TagIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { deleteGalleryItem, updateGalleryItem } from "@/actions/gallery.actions";
import { MEDIA_TYPE_LABELS } from "@/lib/constants";
import { AddGalleryItemDialog } from "./add-gallery-item-dialog";

// ============================================================
// Types
// ============================================================

type GalleryItem = {
  id: string;
  title: string | null;
  description: string | null;
  mediaType: string;
  url: string;
  thumbnailUrl: string | null;
  tags: string[];
  isPublic: boolean;
  order: number;
  bookingId: string | null;
  venueId: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
};

type Venue = {
  id: string;
  name: string;
  _count?: { bookings: number };
};

interface GalleryGridProps {
  data: GalleryItem[];
  venues: Venue[];
}

// ============================================================
// Gallery Grid Component
// ============================================================

export function GalleryGrid({ data, venues }: GalleryGridProps) {
  const [search, setSearch] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter items
  const filteredItems = useMemo(() => {
    return data.filter((item) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchTags) return false;
      }

      // Media type filter
      if (mediaTypeFilter !== "all" && item.mediaType !== mediaTypeFilter) {
        return false;
      }

      // Venue filter
      if (venueFilter !== "all" && item.venueId !== venueFilter) {
        return false;
      }

      // Visibility filter
      if (visibilityFilter === "public" && !item.isPublic) return false;
      if (visibilityFilter === "private" && item.isPublic) return false;

      return true;
    });
  }, [data, search, mediaTypeFilter, venueFilter, visibilityFilter]);

  const hasActiveFilters =
    search ||
    mediaTypeFilter !== "all" ||
    venueFilter !== "all" ||
    visibilityFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setMediaTypeFilter("all");
    setVenueFilter("all");
    setVisibilityFilter("all");
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteGalleryItem(id);
      if (result.success) {
        toast.success("Gallery item deleted");
        setDeleteId(null);
      } else {
        toast.error("Failed to delete", { description: result.error });
      }
    });
  };

  const handleToggleVisibility = (item: GalleryItem) => {
    startTransition(async () => {
      const result = await updateGalleryItem(item.id, {
        isPublic: !item.isPublic,
      });
      if (result.success) {
        toast.success(
          item.isPublic
            ? "Item set to private"
            : "Item set to public"
        );
      } else {
        toast.error("Failed to update visibility", {
          description: result.error,
        });
      }
    });
  };

  return (
    <>
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search gallery..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Media Type Filter */}
          <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Media Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PHOTO">{MEDIA_TYPE_LABELS.PHOTO}</SelectItem>
              <SelectItem value="VIDEO">{MEDIA_TYPE_LABELS.VIDEO}</SelectItem>
            </SelectContent>
          </Select>

          {/* Venue Filter */}
          <Select value={venueFilter} onValueChange={setVenueFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Visibility Filter */}
          <Select
            value={visibilityFilter}
            onValueChange={setVisibilityFilter}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-zinc-500"
            >
              <XIcon className="mr-1 size-3" />
              Clear
            </Button>
          )}
        </div>

        {/* Add Button */}
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <PlusIcon className="mr-2 size-4" />
          Add Item
        </Button>
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <FilterIcon className="size-3.5" />
        <span>
          {filteredItems.length} of {data.length} items
        </span>
      </div>

      {/* Gallery Grid */}
      {filteredItems.length === 0 ? (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100">
              <ImageIcon className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">
              No gallery items found
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              {hasActiveFilters
                ? "Try adjusting your filters to find what you are looking for."
                : "Upload your first photo or video to get started."}
            </p>
            {!hasActiveFilters && (
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <PlusIcon className="mr-2 size-4" />
                Add Item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="group overflow-hidden border-zinc-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200"
            >
              {/* Image / Video Preview */}
              <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                {item.mediaType === "VIDEO" ? (
                  <div className="flex size-full items-center justify-center bg-zinc-900/5">
                    <VideoIcon className="size-12 text-zinc-400" />
                    {item.thumbnailUrl && (
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.title || "Video thumbnail"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                        <VideoIcon className="size-5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Image
                    src={item.thumbnailUrl || item.url}
                    alt={item.title || "Gallery photo"}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                )}

                {/* Visibility Badge */}
                <div className="absolute left-2 top-2">
                  <Badge
                    variant="secondary"
                    className={`text-meta ${
                      item.isPublic
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200"
                    }`}
                  >
                    {item.isPublic ? (
                      <>
                        <GlobeIcon className="mr-0.5 size-2.5" />
                        Public
                      </>
                    ) : (
                      <>
                        <LockIcon className="mr-0.5 size-2.5" />
                        Private
                      </>
                    )}
                  </Badge>
                </div>

                {/* Media Type Badge */}
                <div className="absolute right-2 top-2">
                  <Badge
                    variant="secondary"
                    className="bg-black/50 text-white border-transparent text-meta"
                  >
                    {MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType}
                  </Badge>
                </div>

                {/* Actions Overlay */}
                <div className="absolute right-2 bottom-2 opacity-100 [@media(hover:hover)]:opacity-0 transition-opacity group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="size-8 rounded-full bg-black/50 text-white hover:bg-black/70 border-0 p-0"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleToggleVisibility(item)}
                      >
                        {item.isPublic ? (
                          <>
                            <LockIcon className="mr-2 size-4" />
                            Make Private
                          </>
                        ) : (
                          <>
                            <GlobeIcon className="mr-2 size-4" />
                            Make Public
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <TrashIcon className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Item Info */}
              <CardContent className="p-3">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {item.title || "Untitled"}
                </p>
                {item.description && (
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {item.description}
                  </p>
                )}
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-meta py-0 px-1.5 text-zinc-500"
                      >
                        <TagIcon className="mr-0.5 size-2" />
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 3 && (
                      <Badge
                        variant="outline"
                        className="text-meta py-0 px-1.5 text-zinc-400"
                      >
                        +{item.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                <p className="mt-2 text-meta text-zinc-400">
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <AddGalleryItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        venues={venues}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gallery Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this gallery item? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
