import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Building2, Network, Lock, Users, FileText, ExternalLink,
} from "lucide-react";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { formatDate } from "@/lib/utils";
import { StatusPill } from "@/components/shared/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEmployee, getHrLookups } from "@/actions/hr-employee.actions";
import { getAttendanceSites } from "@/actions/hr-attendance.actions";
import { getStatutoryMasked } from "@/actions/hr-statutory.actions";
import { getEmployeeCompensation } from "@/actions/hr-compensation.actions";
import { getCustomFieldDefs } from "@/actions/hr-config.actions";
import { getEmployeeDocuments } from "@/actions/hr-documents.actions";
import { getDocumentCategories } from "@/actions/hr-documents.actions";
import { AddDocDialog } from "../documents/_components/documents-home";
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_HUE, EMPLOYMENT_TYPE_LABELS,
} from "@/lib/hr/constants";
import { EmployeeEditDialog } from "./_components/employee-edit-dialog";
import { StatutoryPanel } from "./_components/statutory-panel";
import { CompensationPanel } from "./_components/compensation-panel";
import { CustomFieldsCard, RequestEditButton, type ActiveFieldDef } from "./_components/profile-extras";
import { ProfileDetailsPanel } from "./_components/profile-details-panel";
import { EmployeePayslips, type EmployeePayslipRow } from "./_components/employee-payslips";
import { EmployeeUserLink } from "./_components/employee-user-link";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FEATURES.hr) notFound();
  const { id } = await params;

  const [emp, lookups, session, fieldDefs, allSites] = await Promise.all([
    getEmployee(id), getHrLookups(), auth(), getCustomFieldDefs(true), getAttendanceSites(),
  ]);
  if (!emp) notFound();
  // Active sites for the geofence picker; keep any currently-assigned site visible
  // even if it was later deactivated, so the field shows the truth.
  const assignedSet = new Set([...(emp.siteIds ?? []), ...(emp.siteId ? [emp.siteId] : [])]);
  const siteOptions = allSites
    .filter((s) => s.isActive || assignedSet.has(s.id))
    .map((s) => ({ id: s.id, name: s.name }));

  const showDocs = FEATURES.hrDocuments;
  const [empDocs, docCategories] = showDocs
    ? await Promise.all([getEmployeeDocuments(emp.id), getDocumentCategories()])
    : [[], []];

  const role = session?.user?.role ?? "";
  const canWrite = hasPermission(role, "hr:write");
  const canAdmin = hasPermission(role, "hr:admin"); // only hr:admin may link/unlink a login
  const canStatutory = hasPermission(role, "hr:statutory");
  const statutory = canStatutory ? await getStatutoryMasked(emp.id) : null;
  const canPayroll = FEATURES.hrPayroll && hasPermission(role, "hr:payroll");
  const compensation = canPayroll
    ? await getEmployeeCompensation(emp.id)
    : { current: null, history: [] };

  // Payslip history (HR-side). employeeId holds a real Employee.id; there is
  // deliberately no FK relation, so we query HrPayslip directly.
  const payslips: EmployeePayslipRow[] = canPayroll
    ? (
        await prisma.hrPayslip.findMany({
          where: { employeeId: emp.id },
          select: {
            id: true,
            net: true,
            gross: true,
            paidDays: true,
            lopDays: true,
            createdAt: true,
            run: { select: { fy: true, month: true, label: true, status: true } },
          },
          orderBy: [{ run: { fy: "desc" } }, { run: { month: "desc" } }],
        })
      ).map((p) => ({
        id: p.id,
        net: Number(p.net),
        gross: Number(p.gross),
        paidDays: Number(p.paidDays),
        lopDays: Number(p.lopDays),
        createdAt: p.createdAt.toISOString(),
        run: p.run,
      }))
    : [];
  const isSelf = !!emp.user && emp.user.id === session?.user?.id;
  const activeDefs = fieldDefs as unknown as ActiveFieldDef[];
  const customValues = (emp.customFields as Record<string, unknown>) ?? {};

  const name = `${emp.firstName} ${emp.lastName}`.trim();
  const initials = `${emp.firstName[0] ?? ""}${emp.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-6">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All people
      </Link>

      {/* Identity header */}
      <div className="flex flex-wrap items-start gap-5 rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <Avatar size="lg" className="size-16 ring-1 ring-border/60 sm:size-20">
          <AvatarImage src={emp.photoUrl || undefined} alt={name} />
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="numeric tracking-[0.08em]">{emp.empCode}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] leading-tight text-foreground sm:text-[30px]">{name}</h1>
            <StatusPill label={EMPLOYEE_STATUS_LABELS[emp.status]} hue={EMPLOYEE_STATUS_HUE[emp.status]} size="sm" />
          </div>
          {(emp.designation?.name || emp.department?.name) && (
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {[emp.designation?.name, emp.department?.name].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 shrink-0" />{emp.legalEntity?.name ?? "—"}</span>
            {emp.businessVertical && <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5 shrink-0" />{emp.businessVertical.name}</span>}
            {emp.workLocation && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" />{emp.workLocation}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSelf && !canWrite && (
            <RequestEditButton
              employeeId={emp.id}
              current={{ phone: emp.phone, personalEmail: emp.personalEmail, workLocation: emp.workLocation }}
            />
          )}
          {canWrite && (
            <EmployeeEditDialog
              employee={{
                id: emp.id,
                firstName: emp.firstName,
                lastName: emp.lastName,
                gender: emp.gender,
                dob: emp.dob ? emp.dob.toISOString() : null,
                dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.toISOString() : null,
                photoUrl: emp.photoUrl,
                workEmail: emp.workEmail,
                personalEmail: emp.personalEmail,
                phone: emp.phone,
                workLocation: emp.workLocation,
                siteIds: Array.from(assignedSet), // includes any legacy single-site assignment
                attendanceAllSites: emp.attendanceAllSites,
                employmentType: emp.employmentType,
                status: emp.status,
                legalEntityId: emp.legalEntityId,
                businessVerticalId: emp.businessVerticalId,
                departmentId: emp.departmentId,
                designationId: emp.designationId,
                reportingManagerId: emp.reportingManagerId,
              }}
              entities={lookups.entities}
              verticals={lookups.verticals}
              departments={lookups.departments}
              designations={lookups.designations}
              managers={lookups.managers}
              sites={siteOptions}
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-5">
        <TabsList className={TAB_LIST_SCROLL}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          {showDocs && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {canPayroll && <TabsTrigger value="compensation">Compensation</TabsTrigger>}
          {canPayroll && <TabsTrigger value="payslips">Payslips</TabsTrigger>}
          <TabsTrigger value="statutory">Statutory</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          {/* Employee.userId drives ALL self-service (attendance/leave/payslips/
              help desk). Surface it here so an unlinked employee is obvious. */}
          <EmployeeUserLink
            employeeId={emp.id}
            employeeName={`${emp.firstName} ${emp.lastName}`}
            linkedUser={
              emp.user
                ? { id: emp.user.id, email: emp.user.email, role: String(emp.user.role), isActive: emp.user.isActive }
                : null
            }
            canAdmin={canAdmin}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Contact">
              <Row icon={<Mail className="size-3.5" />} label="Work email" value={emp.workEmail} />
              <Row icon={<Mail className="size-3.5" />} label="Personal email" value={emp.personalEmail} />
              <Row icon={<Phone className="size-3.5" />} label="Phone" value={emp.phone} />
            </InfoCard>
            <InfoCard title="Employment">
              <Row label="Type" value={EMPLOYMENT_TYPE_LABELS[emp.employmentType]} />
              <Row label="Date of joining" value={emp.dateOfJoining ? formatDate(emp.dateOfJoining) : null} />
              <Row label="Date of exit" value={emp.dateOfExit ? formatDate(emp.dateOfExit) : null} />
              <Row label="Designation" value={emp.designation?.name} />
            </InfoCard>
            <InfoCard title="Organisation">
              <Row icon={<Building2 className="size-3.5" />} label="Legal entity" value={emp.legalEntity?.name} />
              <Row icon={<Briefcase className="size-3.5" />} label="Business vertical" value={emp.businessVertical?.name} />
              <Row label="Department" value={emp.department?.name} />
              <Row
                icon={<Network className="size-3.5" />}
                label="Reports to"
                value={emp.reportingManager ? `${emp.reportingManager.firstName} ${emp.reportingManager.lastName}` : null}
                href={emp.reportingManager ? `/people/${emp.reportingManager.id}` : undefined}
              />
            </InfoCard>
            {emp.user ? (
              <InfoCard title="App access">
                <Row label="Login email" value={emp.user.email} />
                <Row label="Role" value={emp.user.role} />
                <Row label="Account" value={emp.user.isActive ? "Active" : "Disabled"} />
              </InfoCard>
            ) : (
              <InfoCard title="App access" plain>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  No app login linked yet. App access &amp; role provisioning is set up during onboarding.
                </p>
              </InfoCard>
            )}
          </div>
          <CustomFieldsCard employeeId={emp.id} defs={activeDefs} values={customValues} canWrite={canWrite} />
          {emp.notes && (
            <InfoCard title="Notes" plain>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{emp.notes}</p>
            </InfoCard>
          )}
        </TabsContent>

        {/* Details — emergency contacts, education, work history */}
        <TabsContent value="details">
          <ProfileDetailsPanel
            employeeId={emp.id}
            emergencyContacts={emp.emergencyContacts.map((c) => ({
              id: c.id, name: c.name, relation: c.relation, phone: c.phone,
            }))}
            education={emp.education.map((e) => ({
              id: e.id, institution: e.institution, degree: e.degree, year: e.year,
            }))}
            workHistory={emp.workHistory.map((w) => ({
              id: w.id,
              company: w.company,
              title: w.title,
              fromDate: w.fromDate ? w.fromDate.toISOString() : null,
              toDate: w.toDate ? w.toDate.toISOString() : null,
            }))}
            canWrite={canWrite}
          />
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="space-y-4">
          <InfoCard title={`Direct reports (${emp.reports.length})`} plain>
            {emp.reports.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="No direct reports"
                description="Nobody reports into this employee yet. Set a reporting manager on a colleague's profile to build the line."
                className="py-10"
              />
            ) : (
              <div className="divide-y">
                {emp.reports.map((r) => (
                  <Link key={r.id} href={`/people/${r.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/50">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                        {`${r.firstName[0] ?? ""}${r.lastName[0] ?? ""}`.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.firstName} {r.lastName}</p>
                      <p className="numeric truncate text-[11.5px] text-muted-foreground">{r.empCode}</p>
                    </div>
                    <StatusPill label={EMPLOYEE_STATUS_LABELS[r.status]} hue={EMPLOYEE_STATUS_HUE[r.status]} size="xs" />
                  </Link>
                ))}
              </div>
            )}
          </InfoCard>
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Users className="size-3.5" />
            The reporting line here drives approval routing across Leave, Attendance and Projects.
          </p>
        </TabsContent>

        {/* Employee documents */}
        {showDocs && (
          <TabsContent value="documents">
            <InfoCard
              title="Documents"
              plain
              action={canWrite ? (
                <AddDocDialog categories={docCategories as never} employees={[]} forEmployeeId={emp.id} />
              ) : undefined}
            >
              {empDocs.length === 0 ? (
                <EmptyState
                  icon={<FileText className="size-5" />}
                  title="Nothing on file yet"
                  description="Offer letters, ID proofs and signed contracts for this employee will be listed here."
                  className="py-10"
                />
              ) : (
                <div className="divide-y">
                  {empDocs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                          <FileText className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium">{d.title}</span>
                          <div className="truncate text-[13px] text-muted-foreground">
                            {d.category?.name ?? "Uncategorised"}{d.expiryDate ? ` · expires ${formatDate(d.expiryDate)}` : ""}
                          </div>
                        </div>
                      </div>
                      {d.fileUrl && (
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                          <ExternalLink className="size-3.5" /> Open
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </InfoCard>
          </TabsContent>
        )}

        {/* Compensation — CTC structure + revision history */}
        {canPayroll && (
          <TabsContent value="compensation" className="space-y-4">
            <div className="flex justify-end">
              <a
                href={`/api/hr/form16/${emp.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-[13px] font-medium text-muted-foreground shadow-card transition-colors hover:text-foreground"
              >
                <FileText className="size-3.5" /> Download Form-16
              </a>
            </div>
            <CompensationPanel
              employeeId={emp.id}
              current={compensation.current}
              history={compensation.history}
              canWrite={canPayroll}
            />
          </TabsContent>
        )}

        {/* Payslips — HR-side history; drafts marked & non-downloadable */}
        {canPayroll && (
          <TabsContent value="payslips" className="space-y-4">
            <EmployeePayslips payslips={payslips} />
          </TabsContent>
        )}

        {/* Statutory — encrypted at rest, masked, access-logged */}
        <TabsContent value="statutory">
          {canStatutory && statutory ? (
            <StatutoryPanel employeeId={emp.id} masked={statutory} />
          ) : (
            <InfoCard title="Statutory &amp; bank details" plain>
              <EmptyState
                icon={<Lock className="size-5" />}
                title="Restricted section"
                description="PAN, Aadhaar, PF/UAN and bank details are sensitive statutory PII. You don’t have access to view them."
                className="py-10"
              />
            </InfoCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({
  title, children, action, plain,
}: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
  /** Render children as free-form content instead of the definition-list grid. */
  plain?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      {plain ? children : <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>}
    </div>
  );
}

/** One definition-list entry — quiet label above a solid value. */
function Row({
  icon, label, value, href,
}: {
  icon?: React.ReactNode; label: string; value?: string | null; href?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </dt>
      <dd className="mt-1 text-sm">
        {value ? (
          href ? (
            <Link href={href} className="font-medium text-foreground hover:underline">{value}</Link>
          ) : (
            <span className="break-words font-medium text-foreground">{value}</span>
          )
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </dd>
    </div>
  );
}
