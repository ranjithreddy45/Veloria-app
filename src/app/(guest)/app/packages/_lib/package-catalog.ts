// ============================================================
// Customer-app package catalog — PURE shapes and rules (no IO, client-safe).
// ------------------------------------------------------------
// The Packages screen shows the team's own catalog, never a copy of it:
//   - partner packages are VendorPackage rows (ACTIVE, from ACTIVE vendors), the
//     same rows the Sales quote builder adds as package lines;
//   - Veloria catering is QUOTE_CATALOG.food, the builder's per-plate Food Plan.
// Only customer-safe fields cross the wire: never vendorPrice or discount caps.
// ============================================================

export interface PublicPackageInclusion {
  title: string;
  items: string[];
}

export interface PublicPackage {
  id: string;
  name: string;
  /** VendorPackage.category — the stable category key. */
  category: string;
  categoryLabel: string;
  vendorName: string;
  description: string | null;
  /** customerPrice ?? price — the unit price the quote builder uses. */
  unitPrice: number;
  /** VendorPackagePriceUnit: PER_PLATE | PER_EVENT | PER_PIECE | PER_HOUR | PER_DAY. */
  priceUnit: string;
  /** The package's minimum pax/units; the team refuses a quote line below it. */
  minPax: number | null;
  imageUrl: string | null;
  inclusions: PublicPackageInclusion[];
}

/** One of Veloria's own catering packages (QUOTE_CATALOG.food), priced per plate. */
export interface PublicCateringPackage {
  id: string;
  label: string;
  perPlate: number;
  veg: boolean;
}

export interface PublicPackageGroup {
  key: string;
  label: string;
  packages: PublicPackage[];
}

export interface PublicPackageCatalog {
  /** The hall the partner packages were filtered for (null = every hall). */
  venueId: string | null;
  catering: PublicCateringPackage[];
  groups: PublicPackageGroup[];
}

// ------------------------------------------------------------ hall scope

export interface VenueScoped {
  allVenues: boolean;
  venueIds: readonly string[];
  vendor: { allVenues: boolean; venueIds: readonly string[] } | null;
}

/**
 * The quote builder's hall rule (getQuotePackageOptions and
 * validatePackageLinesAgainstCatalog in quote-packages.actions.ts):
 *   - no hall chosen: everything is offered;
 *   - a package that names specific halls is offered only there;
 *   - a package set to "all halls" defers to its vendor's hall assignment;
 *   - a vendor with no hall assignment at all counts as available everywhere.
 */
export function isOfferedAtVenue(pkg: VenueScoped, venueId: string | null | undefined): boolean {
  const want = venueId?.trim() || null;
  if (!want) return true;
  if (!pkg.allVenues) return pkg.venueIds.includes(want);
  if (pkg.vendor?.allVenues) return true;
  const vendorScope = pkg.vendor?.venueIds ?? [];
  if (vendorScope.length === 0) return true;
  return vendorScope.includes(want);
}

// ------------------------------------------------------------ inclusions

export interface RawPackageSection {
  title: string;
  items: { name: string; type: string; options: readonly string[]; chooseCount: number | null }[];
}

const MAX_SECTIONS = 6;
const MAX_ITEMS_PER_SECTION = 12;
const MAX_OPTIONS_LISTED = 8;

function optionList(options: readonly string[]): string {
  const clean = options.map((o) => o.trim()).filter(Boolean);
  const shown = clean.slice(0, MAX_OPTIONS_LISTED).join(", ");
  return clean.length > MAX_OPTIONS_LISTED ? `${shown}, …` : shown;
}

/**
 * What a package includes, in the words of the team's package builder:
 * fixed items by name, choice items as "choose N of …". Section and item
 * counts are capped so a long package can't bloat the public page.
 */
export function describeInclusions(sections: readonly RawPackageSection[]): PublicPackageInclusion[] {
  const out: PublicPackageInclusion[] = [];
  for (const s of sections.slice(0, MAX_SECTIONS)) {
    const items: string[] = [];
    for (const it of s.items.slice(0, MAX_ITEMS_PER_SECTION)) {
      const name = it.name.trim();
      if (!name) continue;
      const opts = optionList(it.options);
      if (it.type === "SINGLE_CHOICE" && opts) items.push(`${name}: choose 1 of ${opts}`);
      else if (it.type === "MULTI_CHOICE" && opts) items.push(`${name}: choose ${it.chooseCount && it.chooseCount > 0 ? it.chooseCount : "any"} of ${opts}`);
      else items.push(name);
    }
    if (items.length > 0) out.push({ title: s.title.trim() || "Included", items });
  }
  return out;
}

// ------------------------------------------------------------ images + labels

/** Inline (base64) uploads larger than this are left out of the public payload. */
export const MAX_INLINE_IMAGE_CHARS = 200_000;

/** A url a phone can load: http(s), a site path, or a small inline image. */
export function customerImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (url.startsWith("data:image/") && url.length <= MAX_INLINE_IMAGE_CHARS) return url;
  return null;
}

/** "av_lighting" → "Av lighting" when no label is configured anywhere. */
export function humanizeKey(key: string): string {
  const s = key.trim().replace(/[_-]+/g, " ").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Other";
}

/**
 * Group packages by category. Categories follow the team's configured order
 * (VendorCategoryDef.sortOrder) and then their label; packages keep the order
 * they arrive in (the reader sorts them by name).
 */
export function groupPackages(packages: readonly PublicPackage[], categoryOrder: ReadonlyMap<string, number>): PublicPackageGroup[] {
  const groups = new Map<string, PublicPackageGroup>();
  for (const p of packages) {
    const g = groups.get(p.category) ?? { key: p.category, label: p.categoryLabel, packages: [] };
    g.packages.push(p);
    groups.set(p.category, g);
  }
  const rank = (key: string) => categoryOrder.get(key) ?? Number.MAX_SAFE_INTEGER;
  return [...groups.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}
