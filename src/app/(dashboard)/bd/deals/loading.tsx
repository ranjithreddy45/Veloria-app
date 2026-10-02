import { BoardSkeleton } from "@/components/shared/list-skeleton";

// The deal board header has one button, New deal, beside the title.
export default function Loading() {
  return <BoardSkeleton headerActions={1} />;
}
