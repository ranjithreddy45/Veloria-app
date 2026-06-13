import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, UserCheck, UserPlus, Plane, Building2, Upload } from "lucide-react";
import { auth } from "@/../auth";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getEmployees, getEmployeeStats, getHrLookups } from "@/actions/hr-employee.actions";
import { DirectoryFilters } from "./_components/directory-filters";
import { DirectoryTable, type DirectoryRow } from "./_components/directory-table";
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard icon={<Users className="size-4" />} label="Total employees" value={stats.total} accent />
              <StatCard icon={<UserCheck className="size-4" />} label="Active" value={stats.active} />
              <StatCard icon={<UserPlus className="size-4" />} label="Onboarding" value={stats.onboarding} />
              <StatCard icon={<Plane className="size-4" />} label="On leave" value={stats.onLeave} />
              <StatCard icon={<Building2 className="size-4" />} label="Legal entities" value={stats.entityCount} />
            </div>
          )}

          <DirectoryFilters
            entities={lookups.entities}
            verticals={lookups.verticals}
            departments={lookups.departments}
          />

          {list.rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <p className="text-sm font-medium">No employees match these filters.</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {sp.q || sp.entity || sp.status
                  ? "Try clearing the filters."
                  : "Add your first employee to get started."}
              </p>
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

function StatCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode; label: string; value: number; accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={accent ? "text-primary" : ""}>{icon}</span>
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
