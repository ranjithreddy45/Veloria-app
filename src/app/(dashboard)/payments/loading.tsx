import { ListSkeleton } from "@/components/shared/list-skeleton";

// The payments header has no actions, so the skeleton reserves no pill.
export default function Loading() {
  return <ListSkeleton headerActions={0} />;
}
