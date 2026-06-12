import type { Metadata } from "next";
import { getProjects } from "@/actions/projects.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsTable, type ProjectRow } from "./_components/projects-table";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const res = await getProjects();
  const rows = (res.success ? (res.data as ProjectRow[]) : []) ?? [];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Venue Projects"
        description="Ready acquired venues to Veloria Grand standards: readiness checklist, CapEx & timeline projection for the owner, operations audit, and launch handover."
      />
      <ProjectsTable rows={rows} />
    </div>
  );
}
