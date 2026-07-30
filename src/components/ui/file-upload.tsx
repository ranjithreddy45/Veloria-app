"use client";

// Reusable file-upload button. Reads the picked file as a base64 data-URL on
// the client (the app's standard pattern — see snag photos / payment receipts)
// and hands it back via onUploaded so the caller can persist it through a
// server action. No external storage backend needed; the data-URL is stored in
// a @db.Text column. Server actions MUST still validate with isSafeReceiptUrl.
// Pass `multiple` + `onUploadedMany` to pick several files in one go (see the
// prop comment for why multi-select gets its own batched callback).

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readAsDataUrl, readImageAsDataUrl } from "@/lib/images/downscale-image";

interface FileUploadBaseProps {
  /** Accept attribute. Defaults to images + PDF. */
  accept?: string;
  /** Max size in MB (client guard, applied per file). Default 5. */
  maxMB?: number;
  /**
   * Downscale large raster images before encoding. ON by default, because the
   * base64 payload has to clear the server-action body limit (see next.config.ts)
   * AND the platform's own request cap — a single 3 MB phone photo inflates to
   * ~4 MB as base64 and fails, which is exactly why "images are not saving" was
   * reported. Only png/jpeg/webp over ~300 KB are touched, PDFs and formats a
   * canvas can't decode pass through byte-for-byte, and the re-encode is kept
   * only when it actually comes out smaller. Set false where pixel fidelity
   * matters more than payload size.
   */
  compressImages?: boolean;
  /** Button label. */
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
  className?: string;
}

interface SingleFileUploadProps extends FileUploadBaseProps {
  multiple?: false;
  /** Called with the data-URL and the original File once read. May be async. */
  onUploaded: (dataUrl: string, file: File) => void | Promise<void>;
  onUploadedMany?: never;
}

interface MultiFileUploadProps extends FileUploadBaseProps {
  multiple: true;
  /**
   * Called ONCE with every picked file. Multi-select must not fan out into N
   * `onUploaded` calls: callers append with `onChange([...value, dataUrl])`, so
   * N rapid calls each close over the same stale `value` and every image but
   * the last is silently lost. One batched call is the whole point of this prop.
   */
  onUploadedMany: (dataUrls: string[], files: File[]) => void | Promise<void>;
  /** Optional fallback; unused while `multiple` is set. */
  onUploaded?: (dataUrl: string, file: File) => void | Promise<void>;
}

export type FileUploadProps = SingleFileUploadProps | MultiFileUploadProps;

export function FileUpload({
  onUploaded,
  onUploadedMany,
  multiple = false,
  accept = "image/png,image/jpeg,image/webp,application/pdf",
  maxMB = 5,
  compressImages = true,
  label = "Upload",
  size = "sm",
  variant = "outline",
  disabled,
  className,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file(s)
    if (picked.length === 0) return;

    // Oversized files are skipped, not fatal — dropping the whole pick because
    // one photo was 8 MB loses the user's other (fine) selections silently.
    const limit = maxMB * 1024 * 1024;
    const files = picked.filter((f) => f.size <= limit);
    const tooBig = picked.filter((f) => f.size > limit);
    if (tooBig.length > 0) {
      toast.error(
        picked.length === 1
          ? `File too large (max ~${maxMB} MB).`
          : `Skipped ${tooBig.length} file(s) over ~${maxMB} MB: ${tooBig
              .map((f) => f.name)
              .join(", ")}`
      );
    }
    if (files.length === 0) return;

    setBusy(true);
    let dataUrls: string[];
    try {
      // readImageAsDataUrl downscales big rasters and passes everything else
      // (PDFs, HEIC) through untouched, so this is safe for document uploads too.
      dataUrls = await Promise.all(
        files.map((f) => (compressImages ? readImageAsDataUrl(f) : readAsDataUrl(f)))
      );
    } catch {
      setBusy(false);
      toast.error(
        files.length === 1
          ? "Could not read the file."
          : "Could not read one of the files."
      );
      return;
    }
    try {
      if (multiple && onUploadedMany) {
        await onUploadedMany(dataUrls, files);
      } else if (onUploaded) {
        await onUploaded(dataUrls[0], files[0]);
      }
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onChange}
      />
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={cn(className)}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {label}
      </Button>
    </>
  );
}
