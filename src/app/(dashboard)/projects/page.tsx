import type { Metadata } from "next";
import { auth } from "@/../auth";
import { getProjects } from "@/actions/projects.actions";
import { getDemoCount } from "@/actions/projects-demo.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsTable, type ProjectRow } from "./_components/projects-table";
import { DemoControls } from "./_components/demo-controls";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const [res, session] = await Promise.all([getProjects(), auth()]);
  const rows = (res.success ? (res.data as ProjectRow[]) : []) ?? [];
  const role = session?.user?.role ?? "";
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const demoCount = isAdmin ? await getDemoCount() : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Venue Projects"
          description="Ready acquired venues to Veloria Grand standards: 9-stage workflow, readiness checklist, CapEx & timeline for the owner, snag register, operations audit, and launch handover."
        />
        {isAdmin && <DemoControls count={demoCount} />}
      </div>
      <ProjectsTable rows={rows} />
    </div>
  );
}
