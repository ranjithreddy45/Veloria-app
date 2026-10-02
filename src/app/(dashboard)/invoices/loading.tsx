"use client";

import { usePathname } from "next/navigation";
import { ListSkeleton } from "@/components/shared/list-skeleton";

// The invoices header has one action, the New invoice pill, in its action slot.
//
// This file is also the loading state of the /invoices child routes (new, a
// single invoice and its edit form), none of which has a loading.tsx of its
// own. None of their headers passes an `actions` cluster, so the pill is
// reserved on /invoices only. All of them have a one-line eyebrow, like the
// landing (the New and Edit forms pass none, so PageHeader shows the module's
// name there), so the eyebrow placeholder is right on every one.
//
// A client component because only the URL tells them apart: the router
// commits the destination URL together with the loading state.
export default function Loading() {
  const pathname = (usePathname() ?? "").replace(/\/+$/, "");
  return pathname === "/invoices" ? <ListSkeleton headerActions={1} /> : <ListSkeleton />;
}
