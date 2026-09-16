import type { LucideIcon } from "lucide-react";
import {
  Accessibility, AirVent, Armchair, ArrowUpDown, BedDouble, Camera, Car, Check, ChefHat, Coffee,
  Disc3, DoorOpen, Eye, Flame, Flower2, Landmark, Lightbulb, Martini, Palette, Presentation,
  Projector, ShieldCheck, Sofa, Sparkles, Speaker, Sun, Tent, Theater, Trees, Users, Waves, Wifi, Zap,
} from "lucide-react";

// ============================================================
// "What this space offers" — an icon for each of a hall's amenities.
//
// Venue.amenities is free text the team types in Settings → Venues, so this
// matches on the words that appear in it rather than on a fixed list. Two
// rules hold everywhere:
//   - the amenity's OWN text is always what the screen prints. The icon is
//     decoration; it never renames, groups or summarises an amenity.
//   - anything unrecognised keeps its text and gets the neutral tick, so a
//     newly typed amenity can never be dropped by this file.
// The first matching rule wins, so the order below matters: "Lake View" is
// water before it is a view, "Bridal / green room" is bridal before it is a
// room.
// ============================================================

export type AmenityIconKey =
  | "catering" | "parking" | "airConditioning" | "wifi" | "floral" | "stage" | "sound" | "lighting"
  | "dance" | "bar" | "bridal" | "greenRoom" | "meeting" | "lounge" | "entrance" | "stay" | "water"
  | "garden" | "tent" | "outdoor" | "view" | "heritage" | "fire" | "screen" | "presentation"
  | "refreshments" | "elevator" | "accessible" | "power" | "security" | "photography" | "decor"
  | "other";

/** The neutral icon for an amenity this file does not recognise. */
export const FALLBACK_AMENITY_ICON: AmenityIconKey = "other";

export const AMENITY_ICON: Record<AmenityIconKey, LucideIcon> = {
  catering: ChefHat,
  parking: Car,
  airConditioning: AirVent,
  wifi: Wifi,
  floral: Flower2,
  stage: Theater,
  sound: Speaker,
  lighting: Lightbulb,
  dance: Disc3,
  bar: Martini,
  bridal: Sparkles,
  greenRoom: Sofa,
  meeting: Users,
  lounge: Armchair,
  entrance: DoorOpen,
  stay: BedDouble,
  water: Waves,
  garden: Trees,
  tent: Tent,
  outdoor: Sun,
  view: Eye,
  heritage: Landmark,
  fire: Flame,
  screen: Projector,
  presentation: Presentation,
  refreshments: Coffee,
  elevator: ArrowUpDown,
  accessible: Accessibility,
  power: Zap,
  security: ShieldCheck,
  photography: Camera,
  decor: Palette,
  other: Check,
};

const RULES: readonly { key: AmenityIconKey; match: RegExp }[] = [
  { key: "catering", match: /\b(?:cater|caterer|caterers|catering|cuisine|food|menu|menus|kitchen|buffet|veg|dining|thali)\b/ },
  { key: "parking", match: /\b(?:parking|valet|car park)\b/ },
  { key: "airConditioning", match: /\b(?:ac|a c|air con|air cooled|air conditioned|air conditioning)\b/ },
  { key: "wifi", match: /\b(?:wifi|wi fi|internet|broadband)\b/ },
  { key: "floral", match: /\b(?:mandap|floral|florist|flower|flowers|garland|garlands)\b/ },
  { key: "stage", match: /\b(?:stage|stages|dais|podium|mandapam)\b/ },
  { key: "sound", match: /\b(?:sound|dj|music|audio|speaker|speakers|mic|microphone|band|pa)\b/ },
  { key: "lighting", match: /\b(?:lighting|light|lights|led|chandelier|chandeliers)\b/ },
  { key: "dance", match: /\b(?:dance|dancing|dancefloor|sangeet)\b/ },
  { key: "bar", match: /\b(?:bar|alcohol|liquor|cocktail|cocktails|mocktail|mocktails)\b/ },
  { key: "bridal", match: /\b(?:bridal|bride|brides|groom)\b/ },
  { key: "greenRoom", match: /\b(?:green room|changing room|changing rooms|dressing room|dressing rooms|makeup|make up)\b/ },
  { key: "meeting", match: /\b(?:breakout|break out|conference|meeting|meetings|boardroom|seminar|training)\b/ },
  { key: "lounge", match: /\b(?:lounge|seating|sofa|sofas|chair|chairs|armchair|furniture)\b/ },
  { key: "entrance", match: /\b(?:entrance|entry|foyer|lobby|porch|portico|driveway|baraat)\b/ },
  { key: "stay", match: /\b(?:accommodation|accomodation|guest room|guest rooms|guest house|lodging|overnight|stay|suite|suites)\b/ },
  { key: "water", match: /\b(?:pool|poolside|lake|lakeside|river|riverfront|waterfront|water|fountain|pond|creek)\b/ },
  { key: "garden", match: /\b(?:garden|gardens|lawn|lawns|greenery|tree|trees)\b|landscap/ },
  { key: "tent", match: /\b(?:tent|tents|gazebo|marquee|canopy|pandal|shamiana)\b/ },
  { key: "outdoor", match: /\b(?:open air|open to sky|outdoor|outdoors|terrace|rooftop|roof top|courtyard|patio|deck|alfresco)\b/ },
  { key: "view", match: /\b(?:view|views|skyline|vista)\b|panoram/ },
  { key: "heritage", match: /\b(?:heritage|architecture|palace|colonial|monument|monuments|vintage)\b/ },
  { key: "fire", match: /\b(?:bonfire|bonfires|fire pit|firepit|fireworks|campfire)\b/ },
  { key: "screen", match: /\b(?:projector|projectors|projection|screen|screens|av|led wall)\b/ },
  { key: "presentation", match: /\b(?:whiteboard|white board|flipchart|flip chart|presentation|presentations)\b/ },
  { key: "refreshments", match: /\b(?:tea|coffee|beverage|beverages|refreshment|refreshments|snack|snacks)\b/ },
  { key: "elevator", match: /\b(?:elevator|elevators|lift|lifts|escalator|escalators)\b/ },
  { key: "accessible", match: /\b(?:wheelchair|accessible|accessibility|ramp|ramps|differently abled)\b/ },
  { key: "power", match: /\b(?:generator|generators|genset|power backup|backup power|ups|electricity)\b/ },
  { key: "security", match: /\b(?:security|cctv|guard|guards|surveillance|bouncer|bouncers)\b/ },
  { key: "photography", match: /\bphoto|videograph|\bcamera\b/ },
  { key: "decor", match: /\bdecor|\btheme\b|\bthemes\b/ },
];

/** Lower-case, punctuation-free words, so "Air-conditioned halls" and "Wi-Fi" match on their words. */
function words(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Which icon suits this amenity's wording — "other" (a neutral tick) when nothing matches. */
export function amenityIconKey(label: string): AmenityIconKey {
  const w = words(label);
  if (!w) return FALLBACK_AMENITY_ICON;
  return RULES.find((r) => r.match.test(w))?.key ?? FALLBACK_AMENITY_ICON;
}

export interface HallAmenity {
  /** The team's own wording, unchanged apart from surrounding whitespace. */
  label: string;
  iconKey: AmenityIconKey;
}

/**
 * A hall's amenities ready to render: same values, same order. Only entries
 * that are blank once trimmed are left out — there is no text to show for
 * those. Nothing else is merged, reworded or removed.
 */
export function hallAmenities(values: readonly (string | null | undefined)[] | null | undefined): HallAmenity[] {
  const out: HallAmenity[] = [];
  for (const raw of values ?? []) {
    const label = typeof raw === "string" ? raw.trim() : "";
    if (!label) continue;
    out.push({ label, iconKey: amenityIconKey(label) });
  }
  return out;
}

/** The icon for an amenity. Decorative: the label beside it carries the meaning. */
export function AmenityIcon({ iconKey, className }: { iconKey: AmenityIconKey; className?: string }) {
  const Icon = AMENITY_ICON[iconKey];
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}
