import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getHrLookups } from "@/actions/hr-employee.actions";
import {
  getOrgDocuments, getDocumentCategories, getDocumentTemplates,
} from "@/actions/hr-documents.actions";
import { prisma } from "@/lib/prisma";
import { DocumentsHome } from "./_components/documents-home";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  if (!FEATURES.hr || !FEATURES.hrDocuments) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) notFound();
  const canWrite = hasPermission(role, "hr:write");
  const canAdmin = hasPermission(role, "hr:admin");

  const [{ docs }, categories, templates, lookups, totalActive] = await Promise.all([
    getOrgDocuments(),
    getDocumentCategories(),
    getDocumentTemplates(),
    getHrLookups(),
    prisma.employee.count({ where: { deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Company policies with read-acknowledgement tracking, employee documents, expiry reminders, and mail-merge letter templates."
      />
      <DocumentsHome
        docs={docs as never}
        categories={categories as never}
        employees={lookups.managers as never}
        templates={templates as never}
        canWrite={canWrite}
        canAdmin={canAdmin}
        totalActive={totalActive}
      />
    </div>
  );
}
