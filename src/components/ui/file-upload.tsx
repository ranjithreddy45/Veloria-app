"use client";

// Reusable file-upload button. Reads the picked file as a base64 data-URL on
// the client (the app's standard pattern — see snag photos / payment receipts)
// and hands it back via onUploaded so the caller can persist it through a
// server action. No external storage backend needed; the data-URL is stored in
// a @db.Text column. Server actions MUST still validate with isSafeReceiptUrl.

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  /** Called with the data-URL and the original File once read. May be async. */
  onUploaded: (dataUrl: string, file: File) => void | Promise<void>;
  /** Accept attribute. Defaults to images + PDF. */
  accept?: string;
  /** Max size in MB (client guard). Default 5. */
  maxMB?: number;
  /** Button label. */
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  onUploaded,
  accept = "image/png,image/jpeg,image/webp,application/pdf",
  maxMB = 5,
  label = "Upload",
  size = "sm",
  variant = "outline",
  disabled,
  className,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`File too large (max ~${maxMB} MB).`);
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await onUploaded(String(reader.result || ""), file);
      } catch {
        toast.error("Upload failed. Please try again.");
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => {
      setBusy(false);
      toast.error("Could not read the file.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
