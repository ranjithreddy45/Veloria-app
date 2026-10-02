import { BoardSkeleton } from "@/components/shared/list-skeleton";

// The pipeline header's actions are Sync leads (pipeline:update, which the
// sales roles hold) and Score deals (ai:admin: admins and finance only).
// loading.tsx has no session, so it reserves the one pill a sales user sees;
// the action slot never moves the title, so an admin's second pill arriving
// is the lesser mismatch.
//
// Its eyebrow of counts wraps to two lines on a phone whenever there is a
// weighted forecast, which an open pipeline almost always has.
export default function Loading() {
  return <BoardSkeleton headerActions={1} headerEyebrowLines={2} />;
}
