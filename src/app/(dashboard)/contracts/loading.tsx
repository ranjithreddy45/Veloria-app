import { ListSkeleton } from "@/components/shared/list-skeleton";

// The contracts header has one button, New Contract, beside the title.
export default function Loading() {
  return <ListSkeleton headerActions={1} />;
}
