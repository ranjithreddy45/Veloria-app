import { ListSkeleton } from "@/components/shared/list-skeleton";

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
// This file is also the fallback for the /leads child routes that have no
// loading.tsx of their own (a lead, new, import). From sm up their title lands
// in the same place, because the action slot never moves the title; on a
// phone, under a one-line eyebrow, their title lands 20px higher.
export default function Loading() {
  return <ListSkeleton headerActions={2} headerEyebrowLines={2} />;
}
