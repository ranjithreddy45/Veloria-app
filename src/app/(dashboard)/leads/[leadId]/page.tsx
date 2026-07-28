import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  PencilIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  UsersIcon,
  IndianRupeeIcon,
  TagIcon,
  ClockIcon,
  TrendingUpIcon,
  FileTextIcon,
  ImageIcon,
  UserPlus as UserPlusIcon,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getLead } from "@/actions/lead.actions";
import { calculateLeadScoreWithBreakdown } from "@/lib/lead-scoring";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LEAD_STATUS_COLORS,
  LEAD_SOURCE_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MacroButton } from "@/components/shared/macro-button";
import { LeadStatusSelect } from "./_components/lead-status-select";
import { LeadDeleteButton } from "./_components/lead-delete-button";
import { LeadQuickActions } from "./_components/lead-quick-actions";
import { LeadInlineFields } from "./_components/lead-inline-fields";
import { AIScoreCard } from "./_components/ai-score-card";
import { AIEmailComposer } from "@/components/ai/ai-email-composer";
import { SmartSuggestions } from "@/components/ai/smart-suggestions";
import { CrmNotesPanel } from "@/components/crm/crm-notes-panel";
import { ScheduleTaskDialog } from "@/components/crm/schedule-task-dialog";
import { ScheduleSiteVisitDialog } from "./_components/schedule-site-visit-dialog";
import { LeadSiteVisits } from "./_components/lead-site-visits";

export const metadata: Metadata = { title: "Lead Details" };

// ============================================================
// Lead Detail Page
// ============================================================

interface LeadDetailPageProps {
  params: Promise<{ leadId: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { leadId } = await params;
  const result = await getLead(leadId);

  if (!result.success || !result.data) {
    notFound();
  }

  const lead = result.data;

  // Assignable users for the inline owner editor (mirrors the edit form's list).
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Calculate score breakdown
  const scoreBreakdown = calculateLeadScoreWithBreakdown({
    estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
    eventDate: lead.eventDate,
    followUpDate: lead.followUpDate,
    source: lead.source,
    guestCount: lead.guestCount,
    status: lead.status,
    createdAt: lead.createdAt,
  });

  // Format currency in Indian format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function formatCurrency(value: any) {
    if (!value) return "--";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  }

  const scoreColor =
    scoreBreakdown.total >= 70
      ? "text-success"
      : scoreBreakdown.total >= 40
        ? "text-warning"
        : "text-destructive";

  const progressColor =
    scoreBreakdown.total >= 70
      ? "[&>div]:bg-success"
      : scoreBreakdown.total >= 40
        ? "[&>div]:bg-warning"
        : "[&>div]:bg-destructive";

  return (
    <div className="space-y-6">
      {/* Header — PageHeader owns the editorial h1 + eyebrow. The status badge
          rides the title-adjacent slot so it reads as part of the headline. */}
      <PageHeader
        icon={UserPlusIcon}
        accent="blue"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>CRM · Lead</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80 numeric normal-case tracking-normal">
              {format(new Date(lead.createdAt), "dd MMM yyyy")}
            </span>
          </div>
        }
        title={lead.title}
        help={<StatusBadge status={lead.status} colorMap={LEAD_STATUS_COLORS} />}
        description={
          lead.createdBy
            ? `Created by ${lead.createdBy.name ?? lead.createdBy.email}`
            : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <AIEmailComposer
            contactId={lead.contact.id}
            contactName={`${lead.contact.firstName} ${lead.contact.lastName}`}
            contactEmail={lead.contact.email}
          />
          <MacroButton entityType="LEAD" entityId={lead.id} />
          <ScheduleTaskDialog leadId={lead.id} />
          <ScheduleSiteVisitDialog
            leadId={lead.id}
            customerName={`${lead.contact.firstName} ${lead.contact.lastName}`.trim()}
            customerPhone={lead.contact.phone ?? ""}
            customerEmail={lead.contact.email ?? ""}
            preferredVenueId={lead.preferredVenueId ?? null}
            defaultHostId={lead.assignedToId ?? null}
          />
          <LeadQuickActions
            leadId={lead.id}
            leadTitle={lead.title}
            contactEmail={lead.contact.email}
            alreadyConverted={!!lead.deal}
          />
          <Button size="sm" asChild>
            <Link href={`/quotations/new?leadId=${lead.id}`}>
              <FileTextIcon className="mr-2 size-4" />
              Create Quotation
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/leads/${lead.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
          <LeadStatusSelect leadId={lead.id} currentStatus={lead.status} />
          <LeadDeleteButton leadId={lead.id} leadTitle={lead.title} />
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Lead Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Lead Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <TagIcon className="text-muted-foreground mt-0.5 size-4" />
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</p>
                    <StatusBadge
                      status={lead.source}
                      colorMap={{
                        WEBSITE: "bg-blue-100 text-blue-800 border-blue-200",
                        REFERRAL: "bg-green-100 text-green-800 border-green-200",
                        SOCIAL_MEDIA: "bg-pink-100 text-pink-800 border-pink-200",
                        WALK_IN: "bg-amber-100 text-amber-800 border-amber-200",
                        PHONE_INQUIRY: "bg-cyan-100 text-cyan-800 border-cyan-200",
                        EMAIL: "bg-indigo-100 text-indigo-800 border-indigo-200",
                        EVENT: "bg-purple-100 text-purple-800 border-purple-200",
                        PARTNER: "bg-teal-100 text-teal-800 border-teal-200",
                        ADVERTISEMENT: "bg-orange-100 text-orange-800 border-orange-200",
                        OTHER: "bg-muted text-foreground border-border",
                      }}
                      label={LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
                    />
                  </div>
                </div>
                {lead.eventType && (
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="text-muted-foreground mt-0.5 size-4" />
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Event Type</p>
                      <p className="text-sm font-medium">{lead.eventType}</p>
                    </div>
                  </div>
                )}
                {lead.eventDate && (
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="text-muted-foreground mt-0.5 size-4" />
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Event Date</p>
                      <p className="numeric text-sm font-medium">
                        {format(new Date(lead.eventDate), "dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                )}
                {lead.guestCount && (
                  <div className="flex items-start gap-3">
                    <UsersIcon className="text-muted-foreground mt-0.5 size-4" />
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Guest Count</p>
                      <p className="numeric text-sm font-medium">
                        {lead.guestCount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                )}
                {lead.estimatedValue && (
                  <div className="flex items-start gap-3">
                    <IndianRupeeIcon className="text-muted-foreground mt-0.5 size-4" />
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Estimated Value
                      </p>
                      <p className="numeric text-sm font-semibold">
                        {formatCurrency(lead.estimatedValue)}
                      </p>
                    </div>
                  </div>
                )}
                {lead.followUpDate && (
                  <div className="flex items-start gap-3">
                    <ClockIcon className="text-muted-foreground mt-0.5 size-4" />
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Follow-up Date</p>
                      <p className="numeric text-sm font-medium">
                        {format(new Date(lead.followUpDate), "dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline (auto-save) editors — owner + next follow-up. Quick
                  edits without opening the full Edit form. */}
              <Separator className="my-4" />
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Quick edit
              </p>
              <LeadInlineFields
                leadId={lead.id}
                assignedToId={lead.assignedToId ?? null}
                followUpDate={lead.followUpDate ?? null}
                users={users}
              />

              {lead.description && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Description</p>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                      {lead.description}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Contact</CardTitle>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/contacts/${lead.contact.id}`}>
                  View Contact
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                  <UserIcon className="size-5" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[15px] font-semibold tracking-[-0.01em]">
                    {lead.contact.firstName} {lead.contact.lastName}
                  </p>
                  {lead.contact.email && (
                    <div className="flex items-center gap-2">
                      <MailIcon className="text-muted-foreground size-3.5" />
                      <span className="text-[13px] text-muted-foreground">
                        {lead.contact.email}
                      </span>
                    </div>
                  )}
                  {lead.contact.phone && (
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="text-muted-foreground size-3.5" />
                      <span className="numeric text-[13px] text-muted-foreground">
                        {lead.contact.phone}
                      </span>
                    </div>
                  )}
                  {lead.contact.company && (
                    <p className="text-[13px] text-muted-foreground">
                      {lead.contact.designation
                        ? `${lead.contact.designation} at `
                        : ""}
                      {lead.contact.company}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & call log — editable, multiple entries per user */}
          <CrmNotesPanel leadId={lead.id} />

          {/* Site visits / tastings booked for this lead */}
          <LeadSiteVisits leadId={lead.id} />

          {/* Quotations raised from this lead */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Quotations</CardTitle>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/quotations/new?leadId=${lead.id}`}>
                  <FileTextIcon className="mr-2 size-4" />
                  New Quotation
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {lead.salesQuotations && lead.salesQuotations.length > 0 ? (
                <div className="divide-y">
                  {lead.salesQuotations.map((q) => (
                    <Link
                      key={q.id}
                      href={`/quotations/${q.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="numeric truncate text-sm font-medium">
                          {q.quoteNumber}
                          {q.version > 1 && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              · v{q.version}
                            </span>
                          )}
                        </p>
                        <p className="text-[13px] text-muted-foreground numeric">
                          {format(new Date(q.createdAt), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="numeric text-sm font-semibold">
                          {formatCurrency(q.grandTotal)}
                        </span>
                        <StatusBadge
                          status={q.status}
                          colorMap={{
                            DRAFT: "bg-muted text-foreground border-border",
                            PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-200",
                            APPROVED: "bg-green-100 text-green-800 border-green-200",
                            SENT: "bg-blue-100 text-blue-800 border-blue-200",
                            REJECTED: "bg-red-100 text-red-800 border-red-200",
                          }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="py-10"
                  icon={<FileTextIcon />}
                  title="No quotations yet"
                  description="Once you've collected the event details, build one with the calculator — the customer and event info will be pre-filled."
                />
              )}
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="size-4" />
                Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.images && lead.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {lead.images.map((src: string, idx: number) => (
                    <a
                      key={idx}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-square overflow-hidden rounded-xl border bg-muted shadow-card transition-shadow hover:shadow-card-hover"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Lead image ${idx + 1}`}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed">
                  <EmptyState
                    className="py-10"
                    icon={<ImageIcon />}
                    title="No images yet"
                    description="Add reference photos when creating or editing the lead."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deal Info (if converted) */}
          {lead.deal && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Converted Deal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">{lead.deal.title}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {lead.deal.stage.name} ·{" "}
                      <span className="numeric">{lead.deal.probability}%</span> probability
                    </p>
                  </div>
                  <p className="numeric shrink-0 text-lg font-semibold tracking-[-0.02em]">
                    {formatCurrency(lead.deal.value)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Score */}
        <div className="space-y-6">
          {/* AI Score Card */}
          <AIScoreCard
            leadId={lead.id}
            aiScore={lead.aiScore ?? null}
            aiScoreReason={lead.aiScoreReason ?? null}
            aiScoredAt={lead.aiScoredAt ?? null}
          />

          {/* Smart Suggestions */}
          <SmartSuggestions entityType="lead" entityId={lead.id} />

          {/* Score Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col gap-0.5 text-base">
                <span className="flex items-center gap-2">
                  <TrendingUpIcon className="size-4" />
                  Lead Score
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  Authoritative — used for prioritisation &amp; sorting
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className={cn("numeric text-4xl font-bold tracking-[-0.03em]", scoreColor)}>
                  {scoreBreakdown.total}
                </span>
                <span className="numeric text-sm text-muted-foreground">/ 100</span>
              </div>
              <Progress
                value={scoreBreakdown.total}
                className={cn("mt-3 h-2", progressColor)}
              />

              <Separator className="my-4" />

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Score Breakdown
                </p>
                {scoreBreakdown.factors.map((factor, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span
                      className={cn(
                        factor.applied
                          ? "text-foreground"
                          : "text-muted-foreground line-through"
                      )}
                    >
                      {factor.label}
                    </span>
                    <span
                      className={cn(
                        "numeric font-medium",
                        factor.applied
                          ? factor.points > 0
                            ? "text-success"
                            : "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {factor.applied
                        ? factor.points > 0
                          ? `+${factor.points}`
                          : factor.points
                        : "--"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span className="numeric">{format(new Date(lead.createdAt), "dd MMM yyyy")}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="numeric">{format(new Date(lead.updatedAt), "dd MMM yyyy")}</span>
                </div>
                {lead.followUpDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Follow-up</span>
                    <span className="numeric">
                      {format(new Date(lead.followUpDate), "dd MMM yyyy")}
                    </span>
                  </div>
                )}
                {lead.eventDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Event Date</span>
                    <span className="numeric">
                      {format(new Date(lead.eventDate), "dd MMM yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
