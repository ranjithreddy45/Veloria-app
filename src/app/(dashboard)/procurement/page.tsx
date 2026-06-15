import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getPurchaseRequisitions } from "@/actions/procurement.actions";
import { ProcurementList } from "./_components/procurement-list";

export const metadata: Metadata = { title: "Procurement" };

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const user = session.user as { id?: string; role?: string };
  if (!user.role || !hasPermission(user.role, "procurement:read")) redirect("/dashboard");

  const canWrite = hasPermission(user.role, "procurement:write");

  const { bookingId } = await searchParams;
  const res = await getPurchaseRequisitions();
  const requisitions = res.success ? res.data : [];

  // "Raise Procurement" from a booking → preselect it in the New dialog.
  let presetBooking: { id: string; label: string } | null = null;
  if (canWrite && bookingId) {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, eventName: true, bookingNumber: true },
    });
    if (b) presetBooking = { id: b.id, label: `${b.eventName} (${b.bookingNumber})` };
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Procurement"
        description="Raise purchase requisitions, route them for approval, and track ordering through receipt."
      />
      <ProcurementList requisitions={requisitions} canWrite={canWrite} presetBooking={presetBooking} />
    </div>
  );
}
