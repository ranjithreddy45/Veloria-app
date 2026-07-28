import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getAttendanceSites } from "@/actions/hr-attendance.actions";
import { SitesAdmin, type Site } from "./_components/sites-admin";

export const metadata: Metadata = { title: "Attendance Sites" };

export default async function SitesPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people");

  const sites = (await getAttendanceSites()) as unknown as Site[];

  return (
    <div className="space-y-6">
      <Link href="/people/attendance" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to attendance
      </Link>
      <PageHeader
        title="Attendance sites"
        description="Geo-fenced check-in locations and allowed office networks for multi-site staff."
      />
      <SitesAdmin sites={sites} />
    </div>
  );
}
