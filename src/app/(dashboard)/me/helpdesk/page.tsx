import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import {
  getMyTickets, getHelpdeskQueue, getHelpdeskCategories, getArticles,
} from "@/actions/hr-helpdesk.actions";
import { HelpdeskHome, SeedCategoriesButton } from "@/app/(dashboard)/people/helpdesk/_components/helpdesk-home";

export const metadata: Metadata = { title: "HR Help Desk" };

// ============================================================
// Employee self-service — HR Help Desk.
// Outside the hr:read-gated /people tree so every employee can raise a ticket.
// The actions self-scope: getMyTickets() returns only the caller's tickets, and
// getHelpdeskQueue() returns rows only for agents.
// ============================================================

export default async function MyHelpdeskPage() {
  if (!FEATURES.hr || !FEATURES.hrHelpdesk) notFound();
  const session = await auth();
  if (!session?.user?.id) notFound();
  const role = session.user.role ?? "";
  const canAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "hr:admin");

  const [my, queue, categories, articles] = await Promise.all([
    getMyTickets(), getHelpdeskQueue(), getHelpdeskCategories(), getArticles(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          icon={MessageCircle}
          accent="cyan"
          eyebrow="My space"
          title="HR Help Desk"
          description="Raise HR queries, track them to resolution with SLAs, and self-serve answers from the knowledge base."
        />
        {canAdmin && categories.length === 0 && <SeedCategoriesButton />}
      </div>
      <HelpdeskHome
        mine={my.mine as never}
        assigned={my.assigned as never}
        isAgent={my.isAgent}
        queue={queue.rows as never}
        requesters={queue.requesters as never}
        categories={categories as never}
        articles={articles as never}
        canAdmin={canAdmin}
      />
    </div>
  );
}
