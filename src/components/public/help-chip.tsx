// ============================================================
// HelpChip — "Questions? WhatsApp / Call us" for client-facing surfaces.
//
// Pass `contact` from getPublicContact() (Settings → Business contact, which
// has the env numbers as its own fallback): the server page loads it and hands
// it down, through client components where needed, so customers reach the
// numbers the team maintains. With no `contact`, the NEXT_PUBLIC_COMPANY_PHONE /
// NEXT_PUBLIC_COMPANY_WHATSAPP constants are used.
//
// Renders NOTHING when no channel is set, so a placeholder number can never
// reach a customer. Support hours show only when they are published.
// Client-safe: nothing server-only is imported.
// ============================================================

import { MessageCircle, Phone } from "lucide-react";
import { COMPANY_PHONE, COMPANY_WHATSAPP } from "@/lib/constants";
import { telLink, waMeHref } from "@/app/(dashboard)/settings/business-contact/_lib/contact-rules";
import { cn } from "@/lib/utils";

/** The published contact fields HelpChip reads. A PublicContact from getPublicContact() fits. */
export interface HelpChipContact {
  phone?: string | null;
  whatsapp?: string | null;
  supportHours?: string | null;
}

interface HelpChipProps {
  /** Optional prefilled WhatsApp message (e.g. an invoice/quote reference). */
  message?: string;
  /** "inline" (compact chips) or "banner" (full-width helper row). */
  variant?: "inline" | "banner";
  className?: string;
  /**
   * The business's published channels, loaded on the server with getPublicContact().
   * When passed it is the whole answer: a number it doesn't have stays hidden.
   * When omitted, the build-time constants are used.
   */
  contact?: HelpChipContact | null;
}

/** The links (and hours) to show, or null when there is no channel at all. */
export function helpChipChannels(contact: HelpChipContact | null | undefined, message?: string) {
  const whatsapp = (contact ? contact.whatsapp : COMPANY_WHATSAPP)?.trim() || null;
  const phone = (contact ? contact.phone : COMPANY_PHONE)?.trim() || null;
  if (!whatsapp && !phone) return null;
  return {
    waHref: whatsapp ? waMeHref(whatsapp, message) : null,
    telHref: phone ? telLink(phone) : null,
    supportHours: contact?.supportHours?.trim() || null,
  };
}

export function HelpChip({ message, variant = "inline", className, contact }: HelpChipProps) {
  const channels = helpChipChannels(contact, message);
  if (!channels) return null;
  const { waHref, telHref, supportHours } = channels;

  const hours = supportHours ? (
    <span className="basis-full text-center text-meta text-muted-foreground">{`Support hours: ${supportHours}`}</span>
  ) : null;

  if (variant === "banner") {
    return (
      <div className={cn("flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-body", className)}>
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
        {hours}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2 text-detail", className)}>
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
      {hours}
    </div>
  );
}
