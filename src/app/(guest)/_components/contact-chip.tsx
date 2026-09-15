import { getPublicContact } from "@/lib/public/business-contact";
import { ContactLinks } from "./contact-links";

/**
 * WhatsApp / Call buttons for customer screens (server component).
 * Renders nothing until a real number exists (Settings → Business contact,
 * or the env fallback). Use it from server pages; client components render
 * <ContactLinks contact={…}> with a PublicContact passed down instead.
 */
export async function ContactChip({ context, className }: { context?: string; className?: string }) {
  const contact = await getPublicContact();
  return <ContactLinks contact={contact} context={context} className={className} />;
}
