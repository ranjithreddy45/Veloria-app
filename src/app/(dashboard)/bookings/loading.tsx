import { ListSkeleton } from "@/components/shared/list-skeleton";

// The bookings header has one action, the New booking pill, in its action slot.
// Its eyebrow (section plus three counts) always wraps to two lines on a phone,
// so the skeleton reserves two there and the title does not drop when the
// page lands.
export default function Loading() {
  return <ListSkeleton headerActions={1} headerEyebrowLines={2} />;
}
