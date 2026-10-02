"use client";

import { usePathname } from "next/navigation";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { LeadDetailSkeleton } from "./[leadId]/_components/lead-detail-skeleton";

// ============================================================
// The BD leads inbox while it loads, and every lead below it.
// ------------------------------------------------------------
// On /bd/leads the header has one button, New Lead, beside the title, so the
// inbox's ListSkeleton reserves one action placeholder.
//
// This file is also the loading state of /bd/leads/<id> on a navigation from
// another module: Next prefetches a route only down to its first loading
// boundary below the shared layout, which is this one, so the lead's own
// [leadId]/loading.tsx is not used then. The inbox's eyebrow-and-pill header
// is the wrong shape for a lead (its bespoke header has a back link and a
// 27px title, which lands at least 8px lower), so any path deeper than
// /bd/leads gets LeadDetailSkeleton, the same skeleton [leadId]/loading.tsx
// draws.
//
// A client component because only the URL tells the two apart: the router
// commits the destination URL together with the loading state.
// ============================================================

export default function Loading() {
  const pathname = (usePathname() ?? "").replace(/\/+$/, "");
  return pathname === "/bd/leads" ? <ListSkeleton headerActions={1} /> : <LeadDetailSkeleton />;
}
