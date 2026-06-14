import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getTicket } from "@/actions/support.actions";
import { SupportDetail } from "../_components/support-detail";

export const metadata: Metadata = { title: "Support Ticket" };

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "support:read")) redirect("/dashboard");

  const canWrite = hasPermission(role, "support:write");
  const res = await getTicket(id);
  if (!res.success) notFound();

  return <SupportDetail ticket={res.data} canWrite={canWrite} />;
}
