// ============================================================
// Meta campaigns kept OUT of the CRM for now.
// ------------------------------------------------------------
// The owner's instruction (2026-10-19): bring every Meta lead in except the
// Hotel sales and Venue acquisition campaigns. Those are matched by name —
// campaign, ad set or form, case-insensitive — because Meta ids aren't known
// to us and marketing names things consistently.
//
// META_EXCLUDED_CAMPAIGNS overrides the list without a deploy: a comma-
// separated list of name fragments, or "none" to exclude nothing. An excluded
// lead is still recorded (MetaLeadCapture, pipeline "excluded_campaign", no
// lead), so taking a campaign off this list and re-running the import brings
// its leads in with their original dates.
// ============================================================

export const EXCLUDED_PIPELINE = "excluded_campaign";

const DEFAULT_EXCLUDED = ["hotel sales", "venue acquisition"];

/** The name fragments currently excluded (lower-case). */
export function excludedCampaignFragments(env: string | undefined = process.env.META_EXCLUDED_CAMPAIGNS): string[] {
  if (env === undefined || env.trim() === "") return DEFAULT_EXCLUDED;
  if (env.trim().toLowerCase() === "none") return [];
  return env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const squash = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, " ").trim();

/**
 * The excluded fragment this lead's campaign / ad set / form name matches, or
 * null to import it. "Hotel_Sales Oct" and "HOTEL-SALES" both match
 * "hotel sales".
 */
export function excludedCampaignMatch(
  names: { campaignName?: string | null; adsetName?: string | null; formName?: string | null },
  fragments: string[] = excludedCampaignFragments(),
): string | null {
  const haystack = [names.campaignName, names.adsetName, names.formName]
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map(squash);
  for (const f of fragments) {
    const needle = squash(f);
    if (needle && haystack.some((h) => h.includes(needle))) return f;
  }
  return null;
}
