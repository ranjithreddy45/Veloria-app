import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getHolidaysAdmin } from "@/actions/hr-leave.actions";
import { HolidaysAdmin, type Holiday } from "./_components/holidays-admin";

export const metadata: Metadata = { title: "Holidays" };

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people/leave");

  const { year } = await searchParams;
  const parsed = Number(year);
  const selectedYear = Number.isInteger(parsed) && parsed > 2000 && parsed < 3000
    ? parsed
    : new Date().getUTCFullYear();

  const rows = await getHolidaysAdmin(selectedYear);
  const holidays: Holiday[] = rows.map((h) => ({
    id: h.id,
    name: h.name,
    date: new Date(h.date).toISOString().slice(0, 10),
    year: h.year,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/people/leave"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to leave
      </Link>
      <PageHeader
        title="Holidays"
        description="Manage the public-holiday calendar. Weekends and these dates are excluded when leave days are counted."
      />
      <HolidaysAdmin holidays={holidays} year={selectedYear} />
    </div>
  );
}
