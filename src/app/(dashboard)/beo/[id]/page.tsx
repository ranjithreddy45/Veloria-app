import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { getBeo, type BeoDetail } from "@/actions/beo.actions";
import { hasPermission } from "@/lib/permissions";
import { BeoDetailView } from "./_components/beo-detail";
import { getBookingCovers } from "@/actions/event-covers.actions";
import { CoversPanel } from "@/components/operations/covers-panel";

export const metadata: Metadata = { title: "Function Sheet" };

export default async function BeoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, session] = await Promise.all([getBeo(id), auth()]);
  if (!res.success) notFound();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canWrite = !!role && hasPermission(role, "beo:write");
  const beo = res.data as BeoDetail;

  // Contracted vs confirmed heads. The sheet was stamped with the contracted
  // count at creation, before any RSVP existed, so both numbers are shown and
  // a person decides which one the kitchen cooks to.
  const covers = await getBookingCovers(beo.bookingId);

  return (
    <div className="space-y-4">
      {covers.success && covers.data.beo && (
        <CoversPanel
          target="beo"
          targetId={covers.data.beo.id}
          covers={covers.data.beo.covers}
          coversSource={covers.data.beo.coversSource}
          headcount={covers.data.headcount}
          noGuestList={covers.data.noGuestList}
          canEdit={canWrite && beo.status !== "LOCKED"}
        />
      )}
      <BeoDetailView beo={beo} canWrite={canWrite} />
    </div>
  );
}
