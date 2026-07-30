import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload, SearchX, UserPlus2, Users, Building2 } from "lucide-react";
import { auth } from "@/../auth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getEmployees, getEmployeeStats, getHrLookups } from "@/actions/hr-employee.actions";
import { getAttendanceSites } from "@/actions/hr-attendance.actions";
import { DirectoryFilters } from "./_components/directory-filters";
import { DirectoryTable, type DirectoryRow } from "./_components/directory-table";
import { HeadcountStrip } from "./_components/headcount-strip";
import { EmployeeFormDialog } from "./_components/employee-form-dialog";
import { SeedFoundation } from "./_components/seed-foundation";

export const metadata: Metadata = { title: "People" };

interface PageProps {
  searchParams: Promise<{
    q?: string; entity?: string; vertical?: string; dept?: string; desig?: string;
    status?: string; page?: string; sort?: string; dir?: string;
  }>;
}

export default async function PeoplePage({ searchParams }: PageProps) {
  if (!FEATURES.hr) notFound();

  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role ?? "";
  const canWrite = hasPermission(role, "hr:write");
  const canAdmin = hasPermission(role, "hr:admin");

  const [lookups, stats, list, sites] = await Promise.all([
    getHrLookups(),
    getEmployeeStats(),
    getEmployees({
      search: sp.q,
      legalEntityId: sp.entity,
      businessVerticalId: sp.vertical,
      departmentId: sp.dept,
      designationId: sp.desig,
      status: sp.status,
      sortBy: sp.sort,
      sortOrder: sp.dir,
      page: sp.page ? parseInt(sp.page, 10) : 1,
    }),
    getAttendanceSites(),
  ]);
  const siteOptions = sites.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name }));

  const needsSeed = lookups.entities.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={Users}
        accent="gold"
        eyebrow="People · Directory"
        title="People"
        description="The single employee master for the whole group — across every legal entity and business vertical. The same record powers Projects, approvals and access everywhere."
      >
        {canWrite && !needsSeed && (
          <>
            <Button variant="outline" asChild className="gap-1.5">
              <Link href="/people/import"><Upload className="size-4" /> Import</Link>
            </Button>
            <EmployeeFormDialog
              entities={lookups.entities}
              verticals={lookups.verticals}
              departments={lookups.departments}
              designations={lookups.designations}
              managers={lookups.managers}
              sites={siteOptions}
            />
          </>
        )}
      </PageHeader>

      {needsSeed ? (
        canAdmin ? (
          <SeedFoundation />
        ) : (
          <div className="rounded-2xl border border-dashed bg-card">
            <EmptyState
              icon={<Building2 className="size-5" />}
              title="The organisation isn’t set up yet"
              description="Legal entities, departments and designations need to exist before people can be added. Ask an HR Manager or Admin to initialise them."
            />
          </div>
        )
      ) : (
        <>
          {stats && (
            <HeadcountStrip
              total={stats.total}
              active={stats.active}
              onboarding={stats.onboarding}
              onLeave={stats.onLeave}
              entityCount={stats.entityCount}
            />
          )}

          <DirectoryFilters
            entities={lookups.entities}
            verticals={lookups.verticals}
            departments={lookups.departments}
            designations={lookups.designations}
          />

          {list.rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card">
              {sp.q || sp.entity || sp.vertical || sp.dept || sp.desig || sp.status ? (
                <EmptyState
                  icon={<SearchX className="size-5" />}
                  title="No employees match these filters"
                  description="Try clearing the search or filters to see the full directory."
                />
              ) : (
                <EmptyState
                  icon={<UserPlus2 className="size-5" />}
                  title="No employees yet"
                  description="Add your first employee to get started — the same record powers Projects, approvals and access everywhere."
                />
              )}
            </div>
          ) : (
            <DirectoryTable
              rows={list.rows as unknown as DirectoryRow[]}
              total={list.total}
              page={list.page}
              pageSize={list.pageSize}
              canWrite={canWrite}
            />
          )}
        </>
      )}
    </div>
  );
}
