import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PencilIcon,
  Building2,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Users,
  Hash,
  ArrowUpRight,
} from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getHallOwner } from "@/actions/hall-owner.actions";
import { getAcqOwnerByPhone } from "@/actions/acq-visit.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HallOwnerStatusPill } from "@/components/shared/status-pill";
import { DotAvatar } from "@/components/shared/dot-avatar";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Hall Owner" };

const MODEL_LABELS: Record<string, string> = {
  REVENUE_SHARE: "Revenue Share",
  FIXED_LEASE: "Fixed Lease",
  HYBRID: "Hybrid",
  MANAGEMENT_FEE: "Management Fee",
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  BANQUET_HALL: "Banquet Hall",
  CONVENTION_CENTER: "Convention Center",
  MARRIAGE_GARDEN: "Marriage Garden",
  MIXED: "Mixed",
};

const OWNERSHIP_LABELS: Record<string, string> = {
  SELF_OWNED: "Self Owned",
  LEASED: "Leased",
  FAMILY_PROPERTY: "Family Property",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.04em]">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

const DASH = <span className="text-muted-foreground">—</span>;

export default async function HallOwnerDetailPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  // RBAC: mirror the owners list guard (owners:read).
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "owners:read")) {
    notFound();
  }

  const { ownerId } = await params;
  const result = await getHallOwner(ownerId);
  if (!result.success || !result.data) notFound();
  const o = result.data;

  const modelLabel = o.commercialModel
    ? MODEL_LABELS[o.commercialModel] ?? o.commercialModel
    : null;

  // Halls / properties owned — live rollup from the BD acquisition pipeline,
  // matched on the owner's phone or WhatsApp number.
  const ownerPhone = o.phone || o.whatsapp || "";
  const halls = ownerPhone
    ? await getAcqOwnerByPhone(ownerPhone).catch(() => ({ found: false }) as Awaited<ReturnType<typeof getAcqOwnerByPhone>>)
    : ({ found: false } as Awaited<ReturnType<typeof getAcqOwnerByPhone>>);
  const linkedProperties = halls.found ? halls.properties ?? [] : [];
  const linkedCount = halls.found ? halls.propertyCount ?? linkedProperties.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={o.ownerName}
        eyebrow={
          <div className="flex items-center gap-3">
            <DotAvatar seed={o.id} name={o.ownerName} size="sm" />
            <span>{o.companyName ?? "Hall Owner"}</span>
            <span className="h-3 w-px bg-border" />
            <HallOwnerStatusPill status={o.contractStatus} size="xs" />
          </div>
        }
        description="Read-only owner profile."
      >
        <Button variant="outline" asChild>
          <Link href={`/owners/${o.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Email">
              {o.email ? (
                <a
                  href={`mailto:${o.email}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <Mail className="size-3.5" />
                  {o.email}
                </a>
              ) : (
                DASH
              )}
            </Field>
            <Field label="Phone">
              {o.phone ? (
                <a
                  href={`tel:${o.phone}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <Phone className="size-3.5" />
                  {o.phone}
                </a>
              ) : (
                DASH
              )}
            </Field>
            <Field label="WhatsApp">
              {o.whatsapp ? (
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="size-3.5" />
                  {o.whatsapp}
                </span>
              ) : (
                DASH
              )}
            </Field>
            <Field label="GSTIN">{o.gstin ?? DASH}</Field>
          </CardContent>
        </Card>

        {/* Property */}
        <Card>
          <CardHeader>
            <CardTitle>Property</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="City">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {o.propertyCity ?? DASH}
              </span>
            </Field>
            <Field label="Property Type">
              {o.propertyType
                ? PROPERTY_TYPE_LABELS[o.propertyType] ?? o.propertyType
                : DASH}
            </Field>
            <Field label="Halls">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                {o.numberOfHalls ?? DASH}
              </span>
            </Field>
            <Field label="Total Capacity">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {o.totalCapacity != null ? o.totalCapacity.toLocaleString("en-IN") : DASH}
              </span>
            </Field>
          </CardContent>
        </Card>

        {/* Commercial model + terms */}
        <Card>
          <CardHeader>
            <CardTitle>Commercial Model</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Engagement Model">{modelLabel ?? DASH}</Field>
            <Field label="Ownership">
              {o.ownershipStatus
                ? OWNERSHIP_LABELS[o.ownershipStatus] ?? o.ownershipStatus
                : DASH}
            </Field>
            <Field label="Revenue Share">
              {o.revenueSharePercent != null
                ? `${Number(o.revenueSharePercent)}%`
                : DASH}
            </Field>
            <Field label="Min. Monthly Guarantee">
              {o.minimumMonthlyGuarantee != null ? (
                <span className="font-semibold text-emerald-700">
                  {formatINR(Number(o.minimumMonthlyGuarantee))}
                </span>
              ) : (
                DASH
              )}
            </Field>
          </CardContent>
        </Card>

        {/* Pipeline / ownership */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Stage">
              <HallOwnerStatusPill status={o.contractStatus} size="xs" />
            </Field>
            <Field label="BD Owner">
              {o.bdOwner ? (
                <span className="inline-flex items-center gap-1.5">
                  <DotAvatar
                    seed={o.bdOwner.id}
                    name={o.bdOwner.name}
                    size="xs"
                  />
                  {o.bdOwner.name ?? "Unnamed"}
                </span>
              ) : (
                <span className="italic text-muted-foreground">Unassigned</span>
              )}
            </Field>
            <Field label="Owner ID">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                <Hash className="size-3" />
                {o.id}
              </span>
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Halls / properties owned — live rollup from the BD pipeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Halls / properties owned</CardTitle>
          <div className="flex items-center gap-4">
            {o.numberOfHalls != null && (
              <div className="text-right">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.04em]">
                  On record
                </p>
                <p className="mt-0.5 inline-flex items-center justify-end gap-1.5 text-sm font-semibold text-foreground">
                  <Building2 className="size-3.5" />
                  {o.numberOfHalls}
                </p>
              </div>
            )}
            <div className="text-right">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.04em]">
                Linked BD
              </p>
              <p className="mt-0.5 text-lg font-semibold text-violet-700">
                {linkedCount}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {linkedProperties.length > 0 ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {linkedProperties.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/bd/leads/${p.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-foreground">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      {p.propertyName}
                      <span className="text-muted-foreground">— {p.locality}</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{p.status}</span>
                      <ArrowUpRight className="size-3.5 text-violet-600" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No linked BD properties found.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {o.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">
              {o.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
