import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listGrades } from "@/actions/hr-grade.actions";
import { GradesAdmin } from "./_components/grades-admin";

export const metadata: Metadata = { title: "Pay Grades" };

export default async function PayGradesPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people");

  const grades = await listGrades();

  return (
    <div className="space-y-6">
      <Link
        href="/people/settings"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> People settings
      </Link>
      <PageHeader
        icon={Layers}
        accent="gold"
        title="Pay Grades"
        description="Define the pay grades and salary bands used across the workforce. Each grade carries a level and an optional CTC range."
      />
      <GradesAdmin grades={grades} />
    </div>
  );
}
