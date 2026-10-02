"use client";

// ============================================================
// LandingListSkeleton: a module landing's ListSkeleton, drawn only on the
// landing itself.
// ------------------------------------------------------------
// A landing's loading.tsx is also the loading state of every child route
// under it: the ones without a loading.tsx of their own, and, on a navigation
// from another module, the ones with one too (Next prefetches a route only
// down to its first loading boundary below the shared layout, which is the
// landing's). The landing's header shape is wrong for those children: its
// action pills and its eyebrow of counts (two lines on a phone) belong to the
// landing, while a record, form or sub-page header has a one-line eyebrow and
// no action cluster. Reserving the landing's shape there draws pills that
// never arrive and, on a phone, drops the title 20px when the page lands.
//
// So the landing's options apply only when the URL is the landing; any deeper
// path gets the plain header. A small client island because only the client
// knows the destination URL while the fallback shows: the router commits the
// new URL together with the loading state.
// ============================================================

import { usePathname } from "next/navigation";
import { ListSkeleton, type ListSkeletonProps } from "@/components/shared/list-skeleton";

export interface LandingListSkeletonProps extends ListSkeletonProps {
  /** The landing's path, e.g. "/leads". Deeper paths get the plain header. */
  landing: string;
}

export function LandingListSkeleton({ landing, rows, ...landingHeader }: LandingListSkeletonProps) {
  const pathname = usePathname();
  const onLanding = (pathname ?? "").replace(/\/+$/, "") === landing;

  return onLanding ? <ListSkeleton rows={rows} {...landingHeader} /> : <ListSkeleton rows={rows} />;
}
