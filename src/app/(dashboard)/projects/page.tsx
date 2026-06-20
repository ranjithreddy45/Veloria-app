import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/../auth";
import { getProjects } from "@/actions/projects.actions";
import { getDemoCount } from "@/actions/projects-demo.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsTable, ProjectsTableSkeleton, type ProjectRow } from "./_components/projects-table";
import { DemoControls } from "./_components/demo-controls";

export const metadata: Metadata = { title: "Projects" };

async function ProjectsList() {
  const res = await getProjects();
  const rows = (res.success ? (res.data as ProjectRow[]) : []) ?? [];
  return <ProjectsTable rows={rows} />;
}

export default async function ProjectsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const demoCount = isAdmin ? await getDemoCount() : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        eyebrow="Projects · Venue readiness"
        title="Venue Projects"
        description="Ready acquired venues to Veloria Grand standards: 9-stage workflow, readiness checklist, CapEx & timeline for the owner, snag register, operations audit, and launch handover."
      >
        {isAdmin && <DemoControls count={demoCount} />}
      </PageHeader>
      <Suspense fallback={<ProjectsTableSkeleton />}>
        <ProjectsList />
      </Suspense>
    </div>
  );
}
