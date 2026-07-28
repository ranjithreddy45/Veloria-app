"use client";

// ============================================================
// LeadImagesField — controlled image upload UI for the Lead create/edit form.
// Uses the app-standard FileUpload (base64 data-URL) pattern and shows thumbnail
// previews with remove buttons. Picked images are lifted into the parent form
// (`value` / `onChange`) and persisted to `Lead.images` by createLead/updateLead.
// ============================================================

import * as React from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { FileUpload } from "@/components/ui/file-upload";
import { isSafeReceiptDataUrl } from "@/lib/sales/receipt";

export function LeadImagesField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (images: string[]) => void;
}) {
  function handleUploaded(dataUrl: string) {
    // Reuse the app's data-URL safety check (image/PDF only). PDFs won't render
    // as a thumbnail but are harmless; we only accept image data-URLs here.
    if (!isSafeReceiptDataUrl(dataUrl) || !dataUrl.startsWith("data:image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    onChange([...value, dataUrl]);
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Images</p>
          <p className="text-muted-foreground text-xs">
            Reference photos, venue shots, mood boards.
          </p>
        </div>
        <FileUpload
          accept="image/png,image/jpeg,image/webp"
          label="Add image"
          onUploaded={handleUploaded}
        />
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((src, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Lead image ${idx + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
