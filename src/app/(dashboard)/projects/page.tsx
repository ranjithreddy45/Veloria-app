import { notFound } from "next/navigation";

import { PROJECTS_MODULE_ENABLED } from "@/config/feature-flags";
import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/../auth";
import { getProjects } from "@/actions/projects.actions";
import { getDemoCount } from "@/actions/projects-demo.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions } from "@/components/ui/quick-actions";
import { ProjectsTable, ProjectsTableSkeleton, type ProjectRow } from "./_components/projects-table";
import { ProjectsMoreMenu } from "./_components/projects-more-menu";

export const metadata: Metadata = { title: "Projects" };

async function ProjectsList() {
  const res = await getProjects();
  const rows = (res.success ? (res.data as ProjectRow[]) : []) ?? [];
  return <ProjectsTable rows={rows} />;
}

export default async function ProjectsPage() {
  if (!PROJECTS_MODULE_ENABLED) notFound();

  const session = await auth();
  const role = session?.user?.role ?? "";
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const demoCount = isAdmin ? await getDemoCount() : 0;

  return (
    <div className="space-y-5">
      {/* No pills: a project is created from a BD deal, not from here, and
          the portfolio, CapEx rate card and vendor views are in the sidebar.
          Admins get a More menu holding the sample-data tool (maintenance,
          so never a header button); everyone else gets no cluster. */}
      <PageHeader
        eyebrow="Projects · Venue readiness"
        title="Venue Projects"
        description="Ready acquired venues to Veloria Grand standards: 9-stage workflow, readiness checklist, CapEx & timeline for the owner, snag register, operations audit, and launch handover."
        actions={isAdmin ? <QuickActions more={<ProjectsMoreMenu count={demoCount} />} /> : undefined}
      />

      <Suspense fallback={<ProjectsTableSkeleton />}>
        <ProjectsList />
      </Suspense>
    </div>
  );
}
