// ============================================================
// Property type → the GST rate that applies to it.
// ------------------------------------------------------------
// WHY THIS EXISTS. Every invoice was raised at whatever rate the person typing
// it chose: 55 of the last 61 went out at 5%, one at 18%, six at nothing. The
// rate is not a preference, it follows from what kind of property the event is
// held at, and nothing in the app said so.
//
// THE RULE (GST, India). A hotel that let any room above ₹7,500 a night in the
// previous financial year is a "specified premises". Its banquet and catering
// package is 18% WITH input credit. Anywhere else, the same package is 5%
// WITHOUT input credit. Renting a hall on its own, with no food, is 18% either
// way, which is why both rates stay on the picker for every property.
//
// Star rating is a proxy, not the rule: 4- and 5-star hotels are above the
// threshold in practice, which is exactly why the team asked for this. A 3-star
// that charges above ₹7,500 is a specified premises too, so the type only sets
// the DEFAULT and every property's rates stay editable.
//
// Pure data and pure functions — no database, no session.
// ============================================================

export interface GstSlabPreset {
  /** Shown in the picker and printed on the invoice. */
  name: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

/** The combined percentage of a preset, for display. */
export function presetTotal(p: GstSlabPreset): number {
  return p.cgstRate + p.sgstRate + p.igstRate;
}

export const GST_18: GstSlabPreset = {
  name: "GST 18% (with input credit)",
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 0,
};

export const GST_5: GstSlabPreset = {
  name: "GST 5% (no input credit)",
  cgstRate: 2.5,
  sgstRate: 2.5,
  igstRate: 0,
};

export const GST_12: GstSlabPreset = {
  name: "GST 12%",
  cgstRate: 6,
  sgstRate: 6,
  igstRate: 0,
};

export const GST_NONE: GstSlabPreset = {
  name: "No GST",
  cgstRate: 0,
  sgstRate: 0,
  igstRate: 0,
};

/** Everything staff can add by hand to a property, beyond the two defaults. */
export const GST_PRESETS: GstSlabPreset[] = [GST_18, GST_12, GST_5, GST_NONE];

export interface PropertyTypeOption {
  value: string;
  label: string;
  /** The combined rate a food-inclusive package attracts at this kind of property. */
  defaultGst: number;
  /** Why, in one line, shown under the picker. */
  hint: string;
}

/**
 * Deliberately a plain string on Venue rather than an enum: adding a category
 * must not need a migration on a 350-model schema. These are the accepted
 * values; anything else is treated as OTHER.
 */
export const PROPERTY_TYPES: PropertyTypeOption[] = [
  {
    value: "HOTEL_5_STAR",
    label: "5-star hotel",
    defaultGst: 18,
    hint: "Rooms above ₹7,500 a night, so the package is 18% with input credit.",
  },
  {
    value: "HOTEL_4_STAR",
    label: "4-star hotel",
    defaultGst: 18,
    hint: "Rooms above ₹7,500 a night, so the package is 18% with input credit.",
  },
  {
    value: "HOTEL_3_STAR",
    label: "3-star hotel",
    defaultGst: 5,
    hint: "5% unless its rooms go above ₹7,500 a night, which makes it 18%.",
  },
  {
    value: "BANQUET_HALL",
    label: "Banquet hall",
    defaultGst: 5,
    hint: "Package with food is 5%. Hall rent on its own stays 18%.",
  },
  {
    value: "CONVENTION_CENTRE",
    label: "Convention centre",
    defaultGst: 5,
    hint: "Package with food is 5%. Hall rent on its own stays 18%.",
  },
  {
    value: "RESORT",
    label: "Resort",
    defaultGst: 5,
    hint: "5% unless its rooms go above ₹7,500 a night, which makes it 18%.",
  },
  {
    value: "LAWN_FARMHOUSE",
    label: "Lawn or farmhouse",
    defaultGst: 5,
    hint: "Package with food is 5%. Ground rent on its own stays 18%.",
  },
  {
    value: "OTHER",
    label: "Other",
    defaultGst: 5,
    hint: "5% by default. Change the property's rates if that is wrong.",
  },
];

export function propertyTypeOption(value?: string | null): PropertyTypeOption | null {
  if (!value) return null;
  return PROPERTY_TYPES.find((t) => t.value === value) ?? null;
}

export function propertyTypeLabel(value?: string | null): string {
  return propertyTypeOption(value)?.label ?? "Not set";
}

/** The rate a property of this type charges by default. Unset types are 5%. */
export function defaultGstFor(propertyType?: string | null): number {
  return propertyTypeOption(propertyType)?.defaultGst ?? 5;
}

export interface DefaultSlab extends GstSlabPreset {
  isDefault: boolean;
}

/**
 * The rate list a property of this type starts with.
 *
 * BOTH rates are always created, because both are genuinely reachable at any
 * property: the same hall is 5% when it is sold as a package with food and 18%
 * when it is let on its own. The property type decides which one is preselected,
 * not which one exists — that is what makes the quotation picker useful rather
 * than a formality.
 */
export function defaultSlabsFor(propertyType?: string | null): DefaultSlab[] {
  const rate = defaultGstFor(propertyType);
  return [
    { ...GST_18, isDefault: rate === 18 },
    { ...GST_5, isDefault: rate !== 18 },
  ];
}
