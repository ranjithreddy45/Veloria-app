import { redirect } from "next/navigation";

// ============================================================
// /bd/followups — folded into the leads list.
//
// This was a separate page running its own query (getFollowupQueue) over the
// same acqLead table, with the same condition, but its own columns and its own
// actions. A BD executive therefore had two places to look at one set of leads,
// and the two could not be filtered, searched or acted on the same way.
//
// It is now a view chip on /bd/leads. The route is kept as a redirect rather
// than deleted so existing links, bookmarks and any muscle memory still land in
// the right place instead of on a 404.
// ============================================================

export default function BdFollowupsPage() {
  redirect("/bd/leads?view=followup");
}
