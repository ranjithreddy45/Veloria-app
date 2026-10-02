import { LandingListSkeleton } from "@/components/shared/landing-list-skeleton";

// The bookings header has one action, the New booking pill, in its action slot.
// Its eyebrow (section plus three counts) always wraps to two lines on a phone,
// so the skeleton reserves two there and the title does not drop when the
// page lands.
//
// This file is also the loading state of the /bookings child routes (new,
// the calendar, blackouts, and every page of a single booking), none of which
// has a loading.tsx of its own. Their headers have
// a one-line eyebrow and no action cluster, so LandingListSkeleton reserves
// the pill and the two-line eyebrow on /bookings only.
export default function Loading() {
  return <LandingListSkeleton landing="/bookings" headerActions={1} headerEyebrowLines={2} />;
}
