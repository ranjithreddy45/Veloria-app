import { BoardSkeleton } from "@/components/shared/list-skeleton";

// The pipeline header has two actions, Sync leads and Score deals.
export default function Loading() {
  return <BoardSkeleton headerActions={2} />;
}
