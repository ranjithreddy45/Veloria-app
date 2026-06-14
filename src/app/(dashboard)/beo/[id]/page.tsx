import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { getBeo, type BeoDetail } from "@/actions/beo.actions";
import { hasPermission } from "@/lib/permissions";
import { BeoDetailView } from "./_components/beo-detail";

export const metadata: Metadata = { title: "Function Sheet" };

export default async function BeoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, session] = await Promise.all([getBeo(id), auth()]);
  if (!res.success) notFound();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canWrite = !!role && hasPermission(role, "beo:write");
  return <BeoDetailView beo={res.data as BeoDetail} canWrite={canWrite} />;
}
