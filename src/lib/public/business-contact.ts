import { prisma } from "@/lib/prisma";

// ============================================================
// Public contact details for customer screens.
// Settings → Business contact (BusinessProfile) wins; the
// NEXT_PUBLIC_COMPANY_PHONE / NEXT_PUBLIC_COMPANY_WHATSAPP env vars are the
// fallback. Nothing is ever invented: a missing value stays null and the
// UI hides the button.
// ============================================================

export interface PublicContact {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  mapUrl: string | null;
  supportHours: string | null;
}

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export async function getPublicContact(): Promise<PublicContact> {
  let row: Awaited<ReturnType<typeof prisma.businessProfile.findFirst>> = null;
  try {
    row = await prisma.businessProfile.findFirst({ orderBy: { updatedAt: "desc" } });
  } catch {
    row = null; // table not pushed yet: fall back to env
  }
  return {
    phone: clean(row?.phone) ?? clean(process.env.NEXT_PUBLIC_COMPANY_PHONE),
    whatsapp: clean(row?.whatsapp) ?? clean(process.env.NEXT_PUBLIC_COMPANY_WHATSAPP),
    email: clean(row?.email),
    address: clean(row?.address),
    mapUrl: clean(row?.mapUrl),
    supportHours: clean(row?.supportHours),
  };
}

/** wa.me link for a number, with optional prefilled text. */
export function whatsappHref(number: string, text?: string): string {
  const digits = number.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** tel: link for a number. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}
