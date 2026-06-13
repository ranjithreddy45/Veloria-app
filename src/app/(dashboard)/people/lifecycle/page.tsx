import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getJourneys } from "@/actions/hr-journey.actions";
import { getHrLookups } from "@/actions/hr-employee.actions";
import { LifecycleHome } from "./_components/lifecycle-home";

export const metadata: Metadata = { title: "Joining & Exits" };

export default async function LifecyclePage() {
  if (!FEATURES.hr || !FEATURES.hrOnboarding) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  const [joining, exits, lookups] = await Promise.all([
    getJourneys("ONBOARDING"),
    getJourneys("OFFBOARDING"),
    getHrLookups(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Joining & Exits"
        description="One command centre for onboarding and offboarding — Day-1 checklists, clearance, exit interviews, and automatic access provisioning/revocation."
      />
      <LifecycleHome
        joining={joining as never}
        exits={exits as never}
        employees={lookups.managers as never}
      />
    </div>
  );
}
