import { ListSkeleton } from "@/components/shared/list-skeleton";

// The leads header's action cluster is the New lead and Import pills, plus a
// More menu (Recompute engagement, Clean up test leads) for the roles allowed
// to use it. loading.tsx has no session, so it reserves the two pills a sales
// user sees. The More button sits in the same row at the same height, so
// when it lands nothing moves.
//
// This file is also the fallback for the /leads child routes that have no
// loading.tsx of their own (a lead, new, import): their title lands in the
// same place, because the action slot never moves the title.
export default function Loading() {
  return <ListSkeleton headerActions={2} />;
}
