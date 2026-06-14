import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload, SearchX, UserPlus2 } from "lucide-react";
import { auth } from "@/../auth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getEmployees, getEmployeeStats, getHrLookups } from "@/actions/hr-employee.actions";
import { DirectoryFilters } from "./_components/directory-filters";
import { DirectoryTable, type DirectoryRow } from "./_components/directory-table";
import { HeadcountStrip } from "./_components/headcount-strip";
import { EmployeeFormDialog } from "./_components/employee-form-dialog";
import { SeedFoundation } from "./_components/seed-foundation";

export const metadata: Metadata = { title: "People" };

interface PageProps {
  searchParams: Promise<{
    q?: string; entity?: string; vertical?: string; dept?: string; status?: string; page?: string;
  }>;
}

export default async function PeoplePage({ searchParams }: PageProps) {
  if (!FEATURES.hr) notFound();

  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role ?? "";
  const canWrite = hasPermission(role, "hr:write");
  const canAdmin = hasPermission(role, "hr:admin");

  const [lookups, stats, list] = await Promise.all([
    getHrLookups(),
    getEmployeeStats(),
    getEmployees({
      search: sp.q,
      legalEntityId: sp.entity,
      businessVerticalId: sp.vertical,
      departmentId: sp.dept,
      status: sp.status,
      page: sp.page ? parseInt(sp.page, 10) : 1,
    }),
  ]);

  const needsSeed = lookups.entities.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="People"
          description="The single employee master for the whole group — across every legal entity and business vertical. The same record powers Projects, approvals and access everywhere."
        />
        {canWrite && !needsSeed && (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="gap-1.5">
              <Link href="/people/import"><Upload className="size-4" /> Import</Link>
            </Button>
            <EmployeeFormDialog
              entities={lookups.entities}
              verticals={lookups.verticals}
              departments={lookups.departments}
              designations={lookups.designations}
              managers={lookups.managers}
            />
          </div>
        )}
      </div>

      {needsSeed ? (
        canAdmin ? (
          <SeedFoundation />
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            The organisation hasn’t been set up yet. Ask an HR Manager or Admin to initialise entities and departments.
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
          />

          {list.rows.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card">
              {sp.q || sp.entity || sp.vertical || sp.dept || sp.status ? (
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
            />
          )}
        </>
      )}
    </div>
  );
}
