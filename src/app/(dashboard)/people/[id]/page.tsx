import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Building2, Network, Lock, Users, FileText, ExternalLink,
} from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { formatDate } from "@/lib/utils";
import { StatusPill } from "@/components/shared/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEmployee, getHrLookups } from "@/actions/hr-employee.actions";
import { getStatutoryMasked } from "@/actions/hr-statutory.actions";
import { getCustomFieldDefs } from "@/actions/hr-config.actions";
import { getEmployeeDocuments } from "@/actions/hr-documents.actions";
import { getDocumentCategories } from "@/actions/hr-documents.actions";
import { AddDocDialog } from "../documents/_components/documents-home";
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_HUE, EMPLOYMENT_TYPE_LABELS,
} from "@/lib/hr/constants";
import { EmployeeEditDialog } from "./_components/employee-edit-dialog";
import { StatutoryPanel } from "./_components/statutory-panel";
import { CustomFieldsCard, RequestEditButton, type ActiveFieldDef } from "./_components/profile-extras";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FEATURES.hr) notFound();
  const { id } = await params;

  const [emp, lookups, session, fieldDefs] = await Promise.all([
    getEmployee(id), getHrLookups(), auth(), getCustomFieldDefs(true),
  ]);
  if (!emp) notFound();

  const showDocs = FEATURES.hrDocuments;
  const [empDocs, docCategories] = showDocs
    ? await Promise.all([getEmployeeDocuments(emp.id), getDocumentCategories()])
    : [[], []];

  const role = session?.user?.role ?? "";
  const canWrite = hasPermission(role, "hr:write");
  const canStatutory = hasPermission(role, "hr:statutory");
  const statutory = canStatutory ? await getStatutoryMasked(emp.id) : null;
  const isSelf = !!emp.user && emp.user.id === session?.user?.id;
  const activeDefs = fieldDefs as unknown as ActiveFieldDef[];
  const customValues = (emp.customFields as Record<string, unknown>) ?? {};

  const name = `${emp.firstName} ${emp.lastName}`.trim();
  const initials = `${emp.firstName[0] ?? ""}${emp.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-5">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All people
      </Link>

      {/* Identity header */}
      <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-5">
        <Avatar size="lg" className="size-16">
          <AvatarImage src={emp.photoUrl || undefined} alt={name} />
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
            <StatusPill label={EMPLOYEE_STATUS_LABELS[emp.status]} hue={EMPLOYEE_STATUS_HUE[emp.status]} size="sm" />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {emp.empCode}
            {emp.designation?.name ? ` · ${emp.designation.name}` : ""}
            {emp.department?.name ? ` · ${emp.department.name}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" />{emp.legalEntity?.name ?? "—"}</span>
            {emp.businessVertical && <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" />{emp.businessVertical.name}</span>}
            {emp.workLocation && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{emp.workLocation}</span>}
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
                workEmail: emp.workEmail,
                personalEmail: emp.personalEmail,
                phone: emp.phone,
                workLocation: emp.workLocation,
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
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          {showDocs && <TabsTrigger value="documents">Documents</TabsTrigger>}
          <TabsTrigger value="statutory">Statutory</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
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
            <InfoCard title="App access">
              {emp.user ? (
                <>
                  <Row label="Login email" value={emp.user.email} />
                  <Row label="Role" value={emp.user.role} />
                  <Row label="Account" value={emp.user.isActive ? "Active" : "Disabled"} />
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  No app login linked yet. App access &amp; role provisioning is set up during onboarding.
                </p>
              )}
            </InfoCard>
          </div>
          <CustomFieldsCard employeeId={emp.id} defs={activeDefs} values={customValues} canWrite={canWrite} />
          {emp.notes && (
            <InfoCard title="Notes"><p className="text-[13px] text-muted-foreground">{emp.notes}</p></InfoCard>
          )}
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="space-y-4">
          <InfoCard title={`Direct reports (${emp.reports.length})`}>
            {emp.reports.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No direct reports.</p>
            ) : (
              <div className="divide-y">
                {emp.reports.map((r) => (
                  <Link key={r.id} href={`/people/${r.id}`}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                        {`${r.firstName[0] ?? ""}${r.lastName[0] ?? ""}`.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{r.firstName} {r.lastName}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{r.empCode}</p>
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
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Documents</h3>
                {canWrite && (
                  <AddDocDialog categories={docCategories as never} employees={[]} forEmployeeId={emp.id} />
                )}
              </div>
              {empDocs.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No documents on file. Offer letters, ID proofs and contracts appear here.</p>
              ) : (
                <div className="divide-y">
                  {empDocs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        <div>
                          <span className="text-[13.5px] font-medium">{d.title}</span>
                          <div className="text-[12px] text-muted-foreground">
                            {d.category?.name ?? "Uncategorised"}{d.expiryDate ? ` · expires ${formatDate(d.expiryDate)}` : ""}
                          </div>
                        </div>
                      </div>
                      {d.fileUrl && (
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
                          <ExternalLink className="size-3.5" /> Open
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Statutory — encrypted at rest, masked, access-logged */}
        <TabsContent value="statutory">
          {canStatutory && statutory ? (
            <StatutoryPanel employeeId={emp.id} masked={statutory} />
          ) : (
            <InfoCard title="Statutory &amp; bank details">
              <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
                <div className="mt-0.5 text-muted-foreground"><Lock className="size-5" /></div>
                <div className="text-[13px] text-muted-foreground">
                  This section contains sensitive statutory PII and is restricted. You don’t have access to view it.
                </div>
              </div>
            </InfoCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({
  icon, label, value, href,
}: {
  icon?: React.ReactNode; label: string; value?: string | null; href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13.5px]">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
      {value ? (
        href ? (
          <Link href={href} className="font-medium hover:underline">{value}</Link>
        ) : (
          <span className="text-right font-medium">{value}</span>
        )
      ) : (
        <span className="text-muted-foreground/60">—</span>
      )}
    </div>
  );
}
