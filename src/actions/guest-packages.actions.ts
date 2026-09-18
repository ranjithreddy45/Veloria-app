"use server";

import { prisma } from "@/lib/prisma";
import { VENDOR_MODULE_CATEGORY_LABELS } from "@/lib/constants";
import {
  customerImageUrl,
  describeInclusions,
  groupPackages,
  humanizeKey,
  isOfferedAtVenue,
  type PublicPackage,
  type PublicPackageCatalog,
} from "@/app/(guest)/app/packages/_lib/package-catalog";
import { cateringCatalog } from "@/app/(guest)/app/packages/_lib/package-pricing";

// ============================================================
// Guest app — PUBLIC package reads (no session needed).
//
// The same catalog the team quotes from, projected to customer-safe fields:
//   - partner packages: VendorPackage rows that are ACTIVE, from ACTIVE vendors,
//     offered at the chosen hall by the quote builder's own hall rule;
//   - Veloria catering: QUOTE_CATALOG.food (per plate).
// Never returned: vendorPrice, discount caps, hall ids. Requests still go
// through requestFromConcierge (signed in) in guest-host.actions.ts.
// ============================================================

const MAX_PACKAGES = 150;

export async function getPublicPackageCatalog(venueId?: string | null): Promise<PublicPackageCatalog> {
  const want = typeof venueId === "string" && venueId.trim() ? venueId.trim().slice(0, 64) : null;
  const catering = cateringCatalog();
  try {
    const rows = await prisma.vendorPackage.findMany({
      where: { status: "ACTIVE", vendor: { status: "ACTIVE" } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: MAX_PACKAGES,
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        customerPrice: true,
        priceUnit: true,
        minPax: true,
        description: true,
        coverImageId: true,
        allVenues: true,
        venueIds: true,
        vendor: { select: { name: true, allVenues: true, venueIds: true } },
        sections: {
          orderBy: { sortOrder: "asc" },
          select: { title: true, items: { orderBy: { sortOrder: "asc" }, select: { name: true, type: true, options: true, chooseCount: true } } },
        },
      },
    });
    const offered = rows.filter((r) => isOfferedAtVenue(r, want));
    if (offered.length === 0) return { venueId: want, catering, groups: [] };

    // Cover photos: pick one image per package first (ids only), then load just those urls.
    const ids = offered.map((r) => r.id);
    const imageRefs = await prisma.vendorPackageImage.findMany({
      where: { packageId: { in: ids } },
      orderBy: [{ packageId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, packageId: true },
    });
    const coverId = new Map<string, string>();
    for (const r of offered) {
      const own = r.coverImageId ? imageRefs.find((i) => i.id === r.coverImageId && i.packageId === r.id) : undefined;
      const first = own ?? imageRefs.find((i) => i.packageId === r.id);
      if (first) coverId.set(r.id, first.id);
    }
    const [covers, defs] = await Promise.all([
      coverId.size > 0
        ? prisma.vendorPackageImage.findMany({ where: { id: { in: [...coverId.values()] } }, select: { id: true, url: true } })
        : Promise.resolve([] as { id: string; url: string }[]),
      prisma.vendorCategoryDef.findMany({
        where: { key: { in: [...new Set(offered.map((r) => r.category))] } },
        select: { key: true, label: true, sortOrder: true },
      }),
    ]);
    const coverUrl = new Map(covers.map((c) => [c.id, c.url]));
    const labelOf = new Map(defs.map((d) => [d.key, d.label]));
    const order = new Map(defs.map((d) => [d.key, d.sortOrder]));

    const packages: PublicPackage[] = offered.map((r) => {
      const cid = coverId.get(r.id);
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        categoryLabel: labelOf.get(r.category) ?? VENDOR_MODULE_CATEGORY_LABELS[r.category] ?? humanizeKey(r.category),
        vendorName: r.vendor.name,
        description: r.description,
        unitPrice: Number(r.customerPrice ?? r.price),
        priceUnit: String(r.priceUnit),
        minPax: r.minPax ?? null,
        imageUrl: cid ? customerImageUrl(coverUrl.get(cid)) : null,
        inclusions: describeInclusions(r.sections.map((s) => ({ title: s.title, items: s.items.map((i) => ({ ...i, type: String(i.type) })) }))),
      };
    });
    return { venueId: want, catering, groups: groupPackages(packages, order) };
  } catch (err) {
    console.error("[PUBLIC_PACKAGES]", err);
    return { venueId: want, catering, groups: [] };
  }
}
