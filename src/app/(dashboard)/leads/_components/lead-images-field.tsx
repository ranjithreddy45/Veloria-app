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

// HEIC/HEIF is the iPhone camera default and is NOT in the app's accepted
// data-URL formats, so it must be called out by name — otherwise the user picks
// their photos, the save reports success, and the images are simply gone.
function isHeicLike(file: File | undefined): boolean {
  if (!file) return false;
  return (
    /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)
  );
}

function rejectionMessage(file: File | undefined): string {
  const name = file?.name || "That file";
  if (isHeicLike(file)) {
    return `${name} isn't a supported image format. iPhone photos: turn on Settings → Camera → Formats → Most Compatible, or share the photo to convert it to JPEG.`;
  }
  return `${name} isn't a supported image format. Please use JPEG, PNG, WebP or GIF.`;
}

export function LeadImagesField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (images: string[]) => void;
}) {
  function handleUploadedMany(dataUrls: string[], files: File[]) {
    // Validate with the SAME gate the server action applies (isSafeReceiptDataUrl,
    // image data-URLs only). Rejecting here is the only place the user can hear
    // about it: server-side the unsupported entry is filtered out and the save
    // still reports success, so the photos vanish without a word.
    const accepted: string[] = [];
    dataUrls.forEach((dataUrl, i) => {
      if (isSafeReceiptDataUrl(dataUrl) && dataUrl.startsWith("data:image/")) {
        accepted.push(dataUrl);
        return;
      }
      toast.error(rejectionMessage(files[i]), { duration: 8000 });
    });
    if (accepted.length === 0) return;
    // ONE onChange for the whole batch — appending per image would re-read the
    // same stale `value` each time and keep only the last one.
    onChange([...value, ...accepted]);
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Images
            {value.length > 0 && (
              <span className="text-muted-foreground ml-1.5 font-normal">
                ({value.length} {value.length === 1 ? "image" : "images"})
              </span>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            Reference photos, venue shots, mood boards. Pick several at once.
          </p>
        </div>
        {/* HEIC/HEIF is listed in `accept` on purpose: iOS otherwise hides those
            files from the picker, so the user sees an empty photo list and
            assumes the app is broken instead of getting the explanatory toast. */}
        <FileUpload
          accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
          label="Add images"
          multiple
          onUploadedMany={handleUploadedMany}
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
