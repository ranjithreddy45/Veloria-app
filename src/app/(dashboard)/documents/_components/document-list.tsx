"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  FileTextIcon,
  SearchIcon,
  FilterIcon,
  PlusIcon,
  XIcon,
  TrashIcon,
  MoreHorizontalIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LockIcon,
  TagIcon,
  FileIcon,
  FileImageIcon,
  FileVideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { deleteDocument } from "@/actions/document.actions";
import { DOCUMENT_CATEGORIES } from "@/schemas/document.schema";
import { UploadDocumentDialog } from "./upload-document-dialog";

// ============================================================
// Types
// ============================================================

type Document = {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: string;
  url: string | null;
  isPublic: boolean;
  bookingId: string | null;
  contactId: string | null;
  venueId: string | null;
  uploadedById: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Venue = {
  id: string;
  name: string;
  _count?: { bookings: number };
};

interface DocumentListProps {
  data: Document[];
  venues: Venue[];
}

// ============================================================
// Constants
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  INVOICE: "Invoice",
  PROPOSAL: "Proposal",
  PHOTO: "Photo",
  VIDEO: "Video",
  FLOOR_PLAN: "Floor Plan",
  MENU: "Menu",
  LICENSE: "License",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  CONTRACT: "bg-blue-100 text-blue-800 border-blue-200",
  INVOICE: "bg-green-100 text-green-800 border-green-200",
  PROPOSAL: "bg-purple-100 text-purple-800 border-purple-200",
  PHOTO: "bg-pink-100 text-pink-800 border-pink-200",
  VIDEO: "bg-red-100 text-red-800 border-red-200",
  FLOOR_PLAN: "bg-amber-100 text-amber-800 border-amber-200",
  MENU: "bg-orange-100 text-orange-800 border-orange-200",
  LICENSE: "bg-cyan-100 text-cyan-800 border-cyan-200",
  INSURANCE: "bg-indigo-100 text-indigo-800 border-indigo-200",
  OTHER: "bg-zinc-100 text-zinc-800 border-zinc-200",
};

// ============================================================
// Helpers
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <FileImageIcon className="size-8 text-pink-400" />;
  }
  if (mimeType.startsWith("video/")) {
    return <FileVideoIcon className="size-8 text-red-400" />;
  }
  if (mimeType.includes("pdf")) {
    return <FileTextIcon className="size-8 text-red-500" />;
  }
  return <FileIcon className="size-8 text-zinc-400" />;
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word") || mimeType.includes("document")) return "DOC";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "XLS";
  if (mimeType.startsWith("image/")) {
    const ext = mimeType.split("/")[1]?.toUpperCase();
    return ext || "IMG";
  }
  if (mimeType.startsWith("video/")) {
    const ext = mimeType.split("/")[1]?.toUpperCase();
    return ext || "VID";
  }
  return mimeType.split("/").pop()?.toUpperCase() || "FILE";
}

// ============================================================
// Document List Component
// ============================================================

export function DocumentList({ data, venues }: DocumentListProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter items
  const filteredItems = useMemo(() => {
    return data.filter((doc) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchName = doc.name.toLowerCase().includes(q);
        const matchFileName = doc.fileName.toLowerCase().includes(q);
        const matchTags = doc.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchFileName && !matchTags) return false;
      }

      // Category filter
      if (categoryFilter !== "all" && doc.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [data, search, categoryFilter]);

  const hasActiveFilters = search || categoryFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteDocument(id);
      if (result.success) {
        toast.success("Document deleted");
        setDeleteId(null);
      } else {
        toast.error("Failed to delete", { description: result.error });
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
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
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

        {/* Upload Button */}
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <PlusIcon className="mr-2 size-4" />
          Upload Document
        </Button>
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <FilterIcon className="size-3.5" />
        <span>
          {filteredItems.length} of {data.length} documents
        </span>
      </div>

      {/* Documents Grid */}
      {filteredItems.length === 0 ? (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100">
              <FileTextIcon className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">
              No documents found
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              {hasActiveFilters
                ? "Try adjusting your filters to find what you are looking for."
                : "Upload your first document to get started."}
            </p>
            {!hasActiveFilters && (
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <PlusIcon className="mr-2 size-4" />
                Upload Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((doc) => (
            <Card
              key={doc.id}
              className="group overflow-hidden border-zinc-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200"
            >
              {/* File Preview Area */}
              <div className="relative flex aspect-[4/3] items-center justify-center bg-zinc-50">
                {getFileIcon(doc.mimeType)}

                {/* File Type Badge */}
                <div className="absolute right-2 top-2">
                  <Badge
                    variant="secondary"
                    className="bg-black/50 text-white border-transparent text-meta"
                  >
                    {getFileTypeLabel(doc.mimeType)}
                  </Badge>
                </div>

                {/* Visibility Badge */}
                <div className="absolute left-2 top-2">
                  <Badge
                    variant="secondary"
                    className={`text-meta ${
                      doc.isPublic
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200"
                    }`}
                  >
                    {doc.isPublic ? (
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
                      {doc.url && (
                        <DropdownMenuItem
                          onClick={() => window.open(doc.url!, "_blank")}
                        >
                          <ExternalLinkIcon className="mr-2 size-4" />
                          Open
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <TrashIcon className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Document Info */}
              <CardContent className="p-3">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {doc.name}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-meta border font-medium ${
                      CATEGORY_COLORS[doc.category] ||
                      "bg-zinc-100 text-zinc-800 border-zinc-200"
                    }`}
                  >
                    {CATEGORY_LABELS[doc.category] || doc.category}
                  </Badge>
                  <span className="text-meta text-zinc-400">
                    {formatFileSize(doc.size)}
                  </span>
                </div>
                {doc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-meta py-0 px-1.5 text-zinc-500"
                      >
                        <TagIcon className="mr-0.5 size-2" />
                        {tag}
                      </Badge>
                    ))}
                    {doc.tags.length > 3 && (
                      <Badge
                        variant="outline"
                        className="text-meta py-0 px-1.5 text-zinc-400"
                      >
                        +{doc.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                <p className="mt-2 text-meta text-zinc-400">
                  {new Date(doc.createdAt).toLocaleDateString("en-IN", {
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

      {/* Upload Dialog */}
      <UploadDocumentDialog
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
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot
              be undone.
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
