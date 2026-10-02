import { LeadDetailSkeleton } from "./_components/lead-detail-skeleton";

// A BD lead opened from the inbox (/bd/leads) shows this. Opened from another
// module, Next prefetches only down to the first loading boundary below the
// shared layout, which is bd/leads/loading.tsx, so that file's skeleton shows
// instead; it draws this same LeadDetailSkeleton on any path below /bd/leads,
// so the title lands in the same place either way.
export default function Loading() {
  return <LeadDetailSkeleton />;
}
