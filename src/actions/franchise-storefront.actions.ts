"use server";

// ============================================================
// White-label storefront loader — PUBLIC (no auth)
// ============================================================
// Powers /s/<slug>. The slug is the unguessable public access token. This
// action returns ONLY brand theming + the public venue detail that
// getStorefrontVenue already exposes. It MUST NOT leak partner financials,
// onboardingData (KYC/bank), revenue-share figures, contactEmail/Phone, the
// partner name, or any sibling venues. Returns null (→ 404) when the slug is
// unknown, the storefront is not live, or the venue is inactive.

import { prisma } from "@/lib/prisma";
import { getStorefrontVenue, type StorefrontVenue } from "@/actions/storefront.actions";

export interface WhiteLabelStorefront {
  slug: string;
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  // Free-form public theme/content overrides (already public-only by design).
  storefrontConfig: Record<string, unknown>;
  venue: StorefrontVenue;
}

export async function getWhiteLabelStorefront(
  slug: string
): Promise<WhiteLabelStorefront | null> {
  try {
    const normalized = (slug ?? "").trim().toLowerCase();
    if (!normalized) return null;

    const fv = await prisma.franchiseVenue.findUnique({
      where: { storefrontSlug: normalized },
      // Select ONLY public-safe brand fields + the venueId join key.
      // Deliberately NOT selecting partner, configs, payouts, etc.
      select: {
        storefrontSlug: true,
        brandName: true,
        logoUrl: true,
        primaryColor: true,
        storefrontConfig: true,
        isStorefrontLive: true,
        venueId: true,
        venue: { select: { isActive: true } },
      },
    });

    if (!fv || !fv.isStorefrontLive) return null;
    if (!fv.venue?.isActive) return null;

    // Delegate the venue's public detail to the existing storefront action so we
    // never re-query raw Venue (avoids leaking non-public columns).
    const venue = await getStorefrontVenue(fv.venueId);
    if (!venue) return null;

    const config =
      fv.storefrontConfig &&
      typeof fv.storefrontConfig === "object" &&
      !Array.isArray(fv.storefrontConfig)
        ? (fv.storefrontConfig as Record<string, unknown>)
        : {};

    return {
      slug: fv.storefrontSlug ?? normalized,
      brandName: fv.brandName ?? null,
      logoUrl: fv.logoUrl ?? null,
      primaryColor: fv.primaryColor ?? null,
      storefrontConfig: config,
      venue,
    };
  } catch (error) {
    console.error("[GET_WHITE_LABEL_STOREFRONT_ERROR]", error);
    return null;
  }
}
