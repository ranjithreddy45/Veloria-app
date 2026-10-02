import { LandingListSkeleton } from "@/components/shared/landing-list-skeleton";

// The leads header's action cluster is the New lead and Import pills, plus a
// More menu (Recompute engagement, Clean up test leads) for the roles allowed
// to use it. loading.tsx has no session, so it reserves the two pills a sales
// user sees. The More button sits in the same row at the same height, so
// when it lands nothing moves.
//
// Its eyebrow (scope count plus pipeline value) wraps to two lines on a phone
// whenever the scope has any pipeline value, which is the common case, so the
// skeleton reserves two lines there.
//
// This file is also the loading state of the /leads child routes: a lead, new
// and import, which have loading.tsx files of their own (shown when they are
// opened from /leads), and cooling, follow-ups, missed calls and SLA, which do
// not. Their headers have a one-line eyebrow and no action cluster, so
// LandingListSkeleton draws the pills and the two-line eyebrow on /leads
// only, and the plain header everywhere below it.
export default function Loading() {
  return <LandingListSkeleton landing="/leads" headerActions={2} headerEyebrowLines={2} />;
}
