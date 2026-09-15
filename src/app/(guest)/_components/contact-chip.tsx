import { MessageCircle, Phone } from "lucide-react";
import { getPublicContact, telHref, whatsappHref } from "@/lib/public/business-contact";

/**
 * Call / WhatsApp buttons for customer screens (server component).
 * Renders nothing until a real number exists (Settings → Business contact,
 * or the env fallback). Use it from server pages; client components should
 * receive a PublicContact prop instead of importing this.
 */
export async function ContactChip({ context, className }: { context?: string; className?: string }) {
  const c = await getPublicContact();
  if (!c.phone && !c.whatsapp) return null;
  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      {c.whatsapp && (
        <a
          href={whatsappHref(c.whatsapp, context)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1f7a4d] px-4 py-3 text-body font-medium text-white"
        >
          <MessageCircle className="size-4" aria-hidden /> WhatsApp us
        </a>
      )}
      {c.phone && (
        <a
          href={telHref(c.phone)}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-body font-medium text-[#1d1d1f]"
        >
          <Phone className="size-4" aria-hidden /> Call us
        </a>
      )}
    </div>
  );
}
