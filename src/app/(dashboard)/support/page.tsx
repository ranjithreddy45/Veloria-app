import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { hasPermission } from "@/lib/permissions";
import { getTickets, type TicketRow } from "@/actions/support.actions";
import { SupportList } from "./_components/support-list";

export const metadata: Metadata = { title: "Customer Support" };

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "support:read")) redirect("/dashboard");

  const canWrite = hasPermission(role, "support:write");
  const res = await getTickets();
  const tickets = (res.success ? res.data : []) as TicketRow[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customer Support"
        description="Track and resolve customer issues — tickets, priorities and threaded replies."
      />
      <SupportList tickets={tickets} canWrite={canWrite} />
    </div>
  );
}
