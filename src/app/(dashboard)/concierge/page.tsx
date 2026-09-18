import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { hasPermission } from "@/lib/permissions";
import { listConciergeThreads, type InboxAssigneeFilter, type InboxStatusFilter } from "@/actions/concierge-inbox.actions";
import { ConciergeInbox } from "./_components/concierge-inbox";

export const metadata: Metadata = { title: "Customer Concierge" };
export const dynamic = "force-dynamic";

// ============================================================
// Team inbox for customer-app conversations. The page checks access itself
// (bookings:read, the same rule middleware applies) so it is safe even before
// the route is registered in middleware and the permissions map.
// ============================================================

export default async function ConciergeInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string | string[]; view?: string | string[]; status?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=%2Fconcierge");
  const user = session.user as { role?: string; perms?: unknown };
  const role = user.role ?? "";
  if (role === "CLIENT" || role === "VENDOR") redirect("/app");
  const perms = Array.isArray(user.perms) ? (user.perms as string[]) : null;
  const allowed =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    (perms ? perms.includes("*") || perms.includes("bookings:read") : hasPermission(role, "bookings:read"));
  if (!allowed) redirect("/not-authorized");

  const sp = await searchParams;
  const view: InboxAssigneeFilter = sp.view === "mine" || sp.view === "unassigned" ? sp.view : "all";
  const status: InboxStatusFilter = sp.status === "closed" ? "CLOSED" : sp.status === "all" ? "ALL" : "OPEN";
  const threadId = typeof sp.thread === "string" && sp.thread ? sp.thread : null;
  const res = await listConciergeThreads({ assignee: view, status });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={MessagesSquare}
        accent="brand"
        eyebrow="Customers"
        title="Customer Concierge"
        description="Conversations from the customer app. Customers see exactly these messages, and each conversation also sits in its owner's task queue."
      />
      <ConciergeInbox
        initial={res.success ? res.data : null}
        loadError={res.success ? null : res.error}
        initialView={view}
        initialStatus={status}
        initialThreadId={threadId}
      />
    </div>
  );
}
