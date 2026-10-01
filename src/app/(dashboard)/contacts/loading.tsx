import { ListSkeleton } from "@/components/shared/list-skeleton";

// The contacts header has one action, the New contact pill, and a meta row
// under the description: the repeat-enquirer link, the truncation note and
// the repair tools. A directory with any repeat enquirer shows that row, so
// the skeleton reserves it and the list does not drop when the page lands.
export default function Loading() {
  return <ListSkeleton headerActions={1} headerMeta />;
}
