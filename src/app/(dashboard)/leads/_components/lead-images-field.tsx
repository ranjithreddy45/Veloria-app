"use client";

// ============================================================
// LeadImagesField — image upload UI for the Lead create/edit form. Uses the
// app-standard FileUpload (base64 data-URL) pattern and shows thumbnail
// previews with remove buttons.
//
// PERSISTENCE FLAG: the Lead model currently has NO field/relation to store
// image references (unlike ProjectPhoto / VendorPackageImage, which are their
// own tables). Persisting these requires a schema change (e.g. a `Lead.images
// String[]` @db.Text column or a `LeadImage` relation) + migration, which is
// intentionally out of scope here. So this field is presentational: picked
// images live in local component state and are NOT saved on submit. Once a
// storage field exists, lift `value`/`onChange` into the parent form and wire
// it into createLead/updateLead.
// ============================================================

import * as React from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { FileUpload } from "@/components/ui/file-upload";
import { isSafeReceiptDataUrl } from "@/lib/sales/receipt";

export function LeadImagesField() {
  const [images, setImages] = React.useState<string[]>([]);

  function handleUploaded(dataUrl: string) {
    // Reuse the app's data-URL safety check (image/PDF only). PDFs won't render
    // as a thumbnail but are harmless; we only accept image data-URLs here.
    if (!isSafeReceiptDataUrl(dataUrl) || !dataUrl.startsWith("data:image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    setImages((prev) => [...prev, dataUrl]);
  }

  function remove(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
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

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
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

      <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-[11.5px]">
        Note: image storage for leads isn&apos;t wired to the database yet — a
        schema field is needed to persist these. Uploads here are preview-only
        until that field is added.
      </p>
    </div>
  );
}
