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
import { uploadDocument } from "@/actions/document.actions";
import { DOCUMENT_CATEGORIES } from "@/schemas/document.schema";

// ============================================================
// Types
// ============================================================

type Venue = {
  id: string;
  name: string;
};

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

// ============================================================
// Component
// ============================================================

export function UploadDocumentDialog({
  open,
  onOpenChange,
  venues,
}: UploadDocumentDialogProps) {
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [url, setUrl] = useState("");
  const [venueId, setVenueId] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const resetForm = () => {
    setName("");
    setCategory("");
    setUrl("");
    setVenueId("");
    setIsPublic(false);
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

    if (!name.trim()) {
      toast.error("Please enter a document name");
      return;
    }

    if (!category) {
      toast.error("Please select a category");
      return;
    }

    // Infer mimeType and fileName from URL
    const urlTrimmed = url.trim();
    let fileName = name.trim();
    let mimeType = "application/octet-stream";
    let size = 0;

    if (urlTrimmed) {
      try {
        const urlObj = new URL(urlTrimmed);
        const pathname = urlObj.pathname;
        const ext = pathname.split(".").pop()?.toLowerCase();
        if (ext) {
          fileName = pathname.split("/").pop() || fileName;
          const mimeMap: Record<string, string> = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            mp4: "video/mp4",
            mov: "video/quicktime",
            avi: "video/x-msvideo",
            svg: "image/svg+xml",
          };
          mimeType = mimeMap[ext] || mimeType;
        }
      } catch {
        // URL parse failed — that's fine, use defaults
      }
    }

    // Category-based size estimate
    const sizeEstimates: Record<string, number> = {
      PHOTO: 2 * 1024 * 1024,
      VIDEO: 50 * 1024 * 1024,
      CONTRACT: 500 * 1024,
      INVOICE: 200 * 1024,
      PROPOSAL: 1 * 1024 * 1024,
      FLOOR_PLAN: 3 * 1024 * 1024,
      MENU: 500 * 1024,
      LICENSE: 300 * 1024,
      INSURANCE: 400 * 1024,
      OTHER: 100 * 1024,
    };
    size = sizeEstimates[category] || 100 * 1024;

    startTransition(async () => {
      const result = await uploadDocument({
        name: name.trim(),
        category: category as typeof DOCUMENT_CATEGORIES[number],
        fileName,
        mimeType,
        size,
        url: urlTrimmed || undefined,
        venueId: venueId || undefined,
        isPublic,
        tags,
      });

      if (result.success) {
        toast.success("Document uploaded", {
          description: `"${name.trim()}" has been added.`,
        });
        resetForm();
        onOpenChange(false);
      } else {
        toast.error("Failed to upload document", {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a new document by providing its details and a file URL.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (required) */}
          <div className="space-y-2">
            <Label htmlFor="doc-name" className="text-sm font-medium">
              Document Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wedding Contract - Smith"
              maxLength={200}
              required
            />
          </div>

          {/* Category (required) + Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc-category" className="text-sm font-medium">
                Category <span className="text-red-500">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Visibility</Label>
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  id="doc-is-public"
                />
                <Label
                  htmlFor="doc-is-public"
                  className="cursor-pointer text-sm font-normal text-muted-foreground"
                >
                  {isPublic ? "Public" : "Private"}
                </Label>
              </div>
            </div>
          </div>

          {/* File URL */}
          <div className="space-y-2">
            <Label htmlFor="doc-url" className="text-sm font-medium">
              File URL
            </Label>
            <Input
              id="doc-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://storage.example.com/files/document.pdf"
            />
            <p className="text-xs text-muted-foreground">
              Enter the URL where the file is stored or hosted.
            </p>
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="doc-venue" className="text-sm font-medium">
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

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="doc-tags" className="text-sm font-medium">
              Tags
            </Label>
            <Input
              id="doc-tags"
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
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
