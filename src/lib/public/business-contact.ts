import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { formatPhoneForDisplay, telLink, waMeHref } from "@/app/(dashboard)/settings/business-contact/_lib/contact-rules";

// ============================================================
// Public contact details for customer screens.
// Settings → Business contact (BusinessProfile) wins; the
// NEXT_PUBLIC_COMPANY_PHONE / NEXT_PUBLIC_COMPANY_WHATSAPP env vars are the
// fallback for the two numbers. Nothing is ever invented: a missing value stays
// null and the UI hides the button.
//
// Server-only (Prisma). Client components render <ContactLinks> from
// src/app/(guest)/_components/contact-links.tsx with a PublicContact prop.
// ============================================================

export interface PublicContact {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  mapUrl: string | null;
  supportHours: string | null;
  /** Business name as written in Settings → Business contact, when set. */
  displayName?: string | null;
}

/** Where a customer-visible number comes from: the team's settings, the server env fallback, or nowhere (hidden). */
export type ContactSource = "settings" | "env" | null;

export interface PublicContactDetails {
  contact: PublicContact;
  sources: { phone: ContactSource; whatsapp: ContactSource };
}

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

/** The single BusinessProfile row (the latest edit wins). Deduped per request. */
const readProfile = cache(async () => {
  try {
    return await prisma.businessProfile.findFirst({ orderBy: { updatedAt: "desc" } });
  } catch {
    return null; // table not pushed yet: fall back to env
  }
});

/** What customers see, plus where each number came from (for the team's settings screen). */
export async function getPublicContactDetails(): Promise<PublicContactDetails> {
  const row = await readProfile();
  const savedPhone = clean(row?.phone);
  const savedWhatsapp = clean(row?.whatsapp);
  const envPhone = clean(process.env.NEXT_PUBLIC_COMPANY_PHONE);
  const envWhatsapp = clean(process.env.NEXT_PUBLIC_COMPANY_WHATSAPP);
  return {
    contact: {
      phone: savedPhone ?? envPhone,
      whatsapp: savedWhatsapp ?? envWhatsapp,
      email: clean(row?.email),
      address: clean(row?.address),
      mapUrl: clean(row?.mapUrl),
      supportHours: clean(row?.supportHours),
      displayName: clean(row?.displayName),
    },
    sources: {
      phone: savedPhone ? "settings" : envPhone ? "env" : null,
      whatsapp: savedWhatsapp ? "settings" : envWhatsapp ? "env" : null,
    },
  };
}

export async function getPublicContact(): Promise<PublicContact> {
  return (await getPublicContactDetails()).contact;
}

/** wa.me link for a number, with optional prefilled text. */
export function whatsappHref(number: string, text?: string): string {
  return waMeHref(number, text);
}

/** tel: link for a number. */
export function telHref(number: string): string {
  return telLink(number);
}

/** "+91 98765 43210" for showing a stored number. */
export { formatPhoneForDisplay };
