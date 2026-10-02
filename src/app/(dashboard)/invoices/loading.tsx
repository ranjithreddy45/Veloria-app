"use client";

import { usePathname } from "next/navigation";
import { ListSkeleton } from "@/components/shared/list-skeleton";

// The invoices header has one action, the New invoice pill, in its action slot.
//
// This file is also the loading state of the /invoices child routes (new, a
// single invoice and its edit form), none of which has a loading.tsx of its
// own. None of their headers passes an `actions` cluster, so the pill is
// reserved on /invoices only. Their eyebrows differ too: a single invoice has
// a one-line eyebrow, like the landing, but the New and Edit forms have none,
// so their title row comes first and their h1 sits 24px higher; those two get
// a header without the eyebrow placeholder.
//
// A client component because only the URL tells them apart: the router
// commits the destination URL together with the loading state.
export default function Loading() {
  const pathname = (usePathname() ?? "").replace(/\/+$/, "");
  if (pathname === "/invoices") return <ListSkeleton headerActions={1} />;
  const isForm = pathname === "/invoices/new" || /^\/invoices\/[^/]+\/edit$/.test(pathname);
  return isForm ? <ListSkeleton headerEyebrow={false} /> : <ListSkeleton />;
}
