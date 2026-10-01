import { ListSkeleton } from "@/components/shared/list-skeleton";

// The bookings header has one action, the New booking pill, in its action slot.
export default function Loading() {
  return <ListSkeleton headerActions={1} />;
}
