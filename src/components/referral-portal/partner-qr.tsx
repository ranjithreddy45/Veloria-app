"use client";

import { useState } from "react";
import { Copy, Check, QrCode as QrIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================
// PartnerQr — renders a shareable QR for a partner's /refer/<code> link.
// ------------------------------------------------------------
// No QR dependency is bundled, so the image is rendered via a public QR image
// service from the FULL link only (the link is itself public — the code is the
// access control, so there is no data leak in encoding it). A copy-link button
// lets partners share via WhatsApp/print.
// ============================================================

interface PartnerQrProps {
  link: string;
  size?: number;
  className?: string;
}

function qrImageUrl(link: string, size: number): string {
  const encoded = encodeURIComponent(link);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

export function PartnerQr({ link, size = 180, className }: PartnerQrProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImageUrl(link, size)}
          alt="Referral QR code"
          width={size}
          height={size}
          className="block rounded-lg"
        />
      </div>
      <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <QrIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground" title={link}>
          {link}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-600" /> Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Copy link
          </>
        )}
      </Button>
    </div>
  );
}
