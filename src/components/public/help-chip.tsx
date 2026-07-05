// ============================================================
// HelpChip — "Questions? WhatsApp / Call us" for client-facing surfaces.
// Reads the configured public contact channels; renders NOTHING when none is
// set (so a placeholder number can never reach a customer). Use on every
// transaction / discovery page and inside error cards.
// ============================================================

import { MessageCircle, Phone } from "lucide-react";
import { COMPANY_PHONE, COMPANY_WHATSAPP, HAS_PUBLIC_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface HelpChipProps {
  /** Optional prefilled WhatsApp message (e.g. an invoice/quote reference). */
  message?: string;
  /** "inline" (compact chips) or "banner" (full-width helper row). */
  variant?: "inline" | "banner";
  className?: string;
}

export function HelpChip({ message, variant = "inline", className }: HelpChipProps) {
  if (!HAS_PUBLIC_CONTACT) return null;

  const waHref = COMPANY_WHATSAPP
    ? `https://wa.me/${COMPANY_WHATSAPP}${message ? `?text=${encodeURIComponent(message)}` : ""}`
    : null;
  const telHref = COMPANY_PHONE ? `tel:${COMPANY_PHONE.replace(/[^\d+]/g, "")}` : null;

  if (variant === "banner") {
    return (
      <div className={cn("flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-[13px]", className)}>
        <span className="text-muted-foreground">Questions about your event?</span>
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300">
            <MessageCircle className="size-3.5" /> WhatsApp us
          </a>
        )}
        {telHref && (
          <a href={telHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary transition hover:bg-primary/20">
            <Phone className="size-3.5" /> Call us
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2 text-[12.5px]", className)}>
      {waHref && (
        <a href={waHref} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 font-medium text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-300">
          <MessageCircle className="size-3.5" /> Questions? WhatsApp us
        </a>
      )}
      {telHref && (
        <a href={telHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 font-medium text-muted-foreground transition hover:text-foreground">
          <Phone className="size-3.5" /> Call
        </a>
      )}
    </div>
  );
}
