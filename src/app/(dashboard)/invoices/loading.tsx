import { ListSkeleton } from "@/components/shared/list-skeleton";

// The invoices header has one action, the New invoice pill, in its action slot.
export default function Loading() {
  return <ListSkeleton headerActions={1} />;
}
