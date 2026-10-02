import { ListSkeleton } from "@/components/shared/list-skeleton";

// The BD leads header has one button, New Lead, beside the title.
export default function Loading() {
  return <ListSkeleton headerActions={1} />;
}
