import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FEATURES } from "@/config/features";
import { getTicket } from "@/actions/hr-helpdesk.actions";
import { TicketDetail } from "./_components/ticket-detail";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FEATURES.hr || !FEATURES.hrHelpdesk) notFound();
  const { id } = await params;
  const data = await getTicket(id);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <Link href="/people/helpdesk" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Help Desk
      </Link>
      <TicketDetail
        ticket={data.ticket as never}
        comments={data.comments as never}
        requester={data.requester}
        assignee={data.assignee}
        isAgent={data.isAgent}
        myId={data.myId}
      />
    </div>
  );
}
