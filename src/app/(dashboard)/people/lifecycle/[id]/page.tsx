import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { getJourney } from "@/actions/hr-journey.actions";
import { JourneyDetail, PortalInviteButton } from "./_components/journey-detail";

export const metadata: Metadata = { title: "Journey" };

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FEATURES.hr || !FEATURES.hrOnboarding) notFound();
  const { id } = await params;
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  const journey = await getJourney(id);
  if (!journey) notFound();
  const canWrite = hasPermission(session?.user?.role ?? "", "hr:write");
  const canFnf = hasPermission(session?.user?.role ?? "", "hr:payroll");

  const isOnboarding = journey.type === "ONBOARDING";
  const name = `${journey.employee.firstName} ${journey.employee.lastName}`;
  const total = journey.tasks.length;
  const done = journey.tasks.filter((t) => t.status === "DONE" || t.status === "NA").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <Link href="/people/lifecycle" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Joining & Exits
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={name}
          eyebrow={isOnboarding ? "Onboarding" : "Offboarding"}
          description={`${journey.employee.empCode} · ${journey.targetDate ? `${isOnboarding ? "Joins" : "Last day"} ${formatDate(journey.targetDate)}` : "No date set"} · ${done}/${total} tasks (${pct}%)`}
        />
        <div className="flex items-center gap-2">
          <StatusPill
            label={journey.status === "COMPLETED" ? "Completed" : journey.status === "CANCELLED" ? "Cancelled" : "In progress"}
            hue={journey.status === "COMPLETED" ? "emerald" : journey.status === "CANCELLED" ? "slate" : "amber"}
            size="sm"
          />
          {canWrite && isOnboarding && journey.status === "IN_PROGRESS" && (
            <PortalInviteButton employeeId={journey.employee.id} />
          )}
          {canFnf && !isOnboarding && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/people/payroll/fnf?employeeId=${journey.employee.id}`}>
                <Wallet className="size-3.5" /> Start Full & Final
              </Link>
            </Button>
          )}
        </div>
      </div>

      <JourneyDetail journey={journey as never} canWrite={canWrite} />
    </div>
  );
}
