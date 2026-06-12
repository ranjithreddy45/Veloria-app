import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getProject } from "@/actions/projects.actions";
import { ProjectDetail } from "../_components/project-detail";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, session] = await Promise.all([getProject(id), auth()]);
  if (!res.success || !res.data) notFound();

  const role = session?.user?.role ?? "";
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const perms = {
    canUpdate: isAdmin || hasPermission(role, "projects:update"),
    canApprove: isAdmin || hasPermission(role, "projects:approve"),
    canAudit: isAdmin || hasPermission(role, "projects:audit"),
  };

  return (
    <div className="space-y-6">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ProjectDetail project={res.data as any} perms={perms} />
    </div>
  );
}
