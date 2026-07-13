"use client";

// ============================================================
// Event / readiness photo panel.
// ------------------------------------------------------------
// Three labelled buckets — Pre-readiness, Post-readiness, During event —
// each showing its thumbnails and (when the user has gallery:create) a
// FileUpload that persists a base64 data-URL via createGalleryItem, then
// refreshes. Photos are stored isPublic:false (internal ops record).
// ============================================================

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { createGalleryItem } from "@/actions/gallery.actions";

type PhotoKind = "PRE_READINESS" | "POST_READINESS" | "DURING_EVENT";

export interface BookingPhotoItem {
  id: string;
  url: string;
  kind: string;
  title: string | null;
  createdAt: string | Date;
  mediaType: string;
}

export interface BookingPhotosProps {
  bookingId: string;
  items: BookingPhotoItem[];
  canUploadPhotos: boolean;
}

const BUCKETS: { kind: PhotoKind; label: string }[] = [
  { kind: "PRE_READINESS", label: "Pre-readiness" },
  { kind: "POST_READINESS", label: "Post-readiness" },
  { kind: "DURING_EVENT", label: "During event" },
];

function fmt(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function BookingPhotos({
  bookingId,
  items,
  canUploadPhotos,
}: BookingPhotosProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function upload(kind: PhotoKind, label: string) {
    return (dataUrl: string) => {
      startTransition(async () => {
        const res = await createGalleryItem({
          url: dataUrl,
          kind,
          bookingId,
          isPublic: false,
          title: label,
          mediaType: "PHOTO",
          tags: [],
          order: 0,
        });
        if (res.success) {
          toast.success(`${label} photo uploaded`);
          router.refresh();
        } else {
          toast.error(res.error || "Upload failed");
        }
      });
    };
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4 text-fuchsia-600" />
          Event &amp; Readiness Photos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Upload pre-readiness photos before the event and post-readiness ~1h
          before.
        </p>

        {BUCKETS.map(({ kind, label }) => {
          const bucketItems = items.filter((it) => it.kind === kind);
          return (
            <div key={kind} className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {label}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({bucketItems.length})
                  </span>
                </h3>
                {canUploadPhotos && (
                  <FileUpload
                    accept="image/png,image/jpeg,image/webp"
                    label={`Add ${label.toLowerCase()}`}
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onUploaded={upload(kind, label)}
                  />
                )}
              </div>

              {bucketItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No {label.toLowerCase()} photos yet.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {bucketItems.map((it) => (
                    <a
                      key={it.id}
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${it.title || label} · ${fmt(it.createdAt)}`}
                      className="group relative block aspect-square overflow-hidden rounded-lg border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.url}
                        alt={it.title || label}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
