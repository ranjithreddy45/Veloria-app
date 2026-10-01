import type { Metadata } from "next";
import { Suspense } from "react";
import { FolderKanbanIcon } from "lucide-react";
import { auth } from "@/../auth";
import { getProjects } from "@/actions/projects.actions";
import { getDemoCount } from "@/actions/projects-demo.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions } from "@/components/ui/quick-actions";
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
        icon={FolderKanbanIcon}
        accent="amber"
        eyebrow="Projects · Venue readiness"
        title="Venue Projects"
        description="Ready acquired venues to Veloria Grand standards: 9-stage workflow, readiness checklist, CapEx & timeline for the owner, snag register, operations audit, and launch handover."
      >
        {isAdmin && <DemoControls count={demoCount} />}
      </PageHeader>

      {/* Transitional: these pills predate the verb-only landing rule. `hub` only
          relaxes QuickActions' dev checks (labels, pill count) until this row moves
          into PageHeader `actions`; chips already come from each href. */}
      <QuickActions
        hub
        actions={[
          { href: "/projects/portfolio", label: "Portfolio", hint: "Everything at once" },
          { href: "/projects/rate-card", label: "Rate card", hint: "What we charge" },
          { href: "/projects/vendors", label: "Vendors", hint: "Who is delivering" },
        ]}
      />
      <Suspense fallback={<ProjectsTableSkeleton />}>
        <ProjectsList />
      </Suspense>
    </div>
  );
}
