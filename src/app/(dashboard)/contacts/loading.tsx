import { LandingListSkeleton } from "@/components/shared/landing-list-skeleton";

// The contacts header has one action, the New contact pill, and a meta row
// under the description: the repeat-enquirer link and the truncation note. A
// directory with any repeat enquirer shows that row, so the skeleton reserves
// it and the list does not drop when the page lands. Its eyebrow (section plus
// counts) always wraps to two lines on a phone.
//
// This file is also the loading state of the /contacts child routes (new, a
// single contact and its edit form), none of which has a loading.tsx of its
// own. Their headers have a one-line eyebrow and pass no `actions` cluster,
// so they have no pill and no meta row either. LandingListSkeleton therefore
// reserves the pill, the meta row and the two-line eyebrow on /contacts only,
// and draws the plain header everywhere below it.
export default function Loading() {
  return <LandingListSkeleton landing="/contacts" headerActions={1} headerMeta headerEyebrowLines={2} />;
}
