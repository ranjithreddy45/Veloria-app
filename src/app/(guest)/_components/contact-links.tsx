import { Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicContact } from "@/lib/public/business-contact";
import { telLink, waMeHref } from "@/app/(dashboard)/settings/business-contact/_lib/contact-rules";

/**
 * WhatsApp / Call (and optionally Email) buttons for customer screens.
 *
 * Client-safe: it fetches nothing and imports nothing server-only, so a client
 * component can render it with the PublicContact its server page loaded with
 * getPublicContact(). Server pages can use <ContactChip>, which does that for
 * them. Renders nothing when there is no real channel — never a placeholder.
 */
export function ContactLinks({
  contact,
  context,
  withEmail = false,
  className,
}: {
  contact: PublicContact | null | undefined;
  /** Prefilled WhatsApp message. */
  context?: string;
  /** Also offer an Email button when an address is published. */
  withEmail?: boolean;
  className?: string;
}) {
  const whatsapp = contact?.whatsapp ?? null;
  const phone = contact?.phone ?? null;
  const email = withEmail ? (contact?.email ?? null) : null;
  if (!whatsapp && !phone && !email) return null;

  const button =
    "vg-press inline-flex min-h-12 flex-1 basis-[132px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-body font-semibold";
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {whatsapp && (
        <a
          href={waMeHref(whatsapp, context)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(button, "border border-[#2a9d4a]/20 bg-[#e6f6ea] text-[#1b6b41]")}
        >
          <MessageCircle className="size-4" aria-hidden /> WhatsApp us
        </a>
      )}
      {phone && (
        <a href={telLink(phone)} className={cn(button, "border border-black/[.08] bg-white text-[#1d1d1f]")}>
          <Phone className="size-4" aria-hidden /> Call us
        </a>
      )}
      {email && (
        <a
          href={`mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`}
          className={cn(button, "border border-black/[.08] bg-white text-[#1d1d1f]")}
        >
          <Mail className="size-4" aria-hidden /> Email us
        </a>
      )}
    </div>
  );
}
