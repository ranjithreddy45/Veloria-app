import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  EditIcon,
  ImageIcon,
  CheckIcon,
  ChevronRightIcon,
  ListIcon,
  PackageIcon,
} from "lucide-react";

import { getPackage } from "@/actions/vendor-catalog.actions";
import {
  VENDOR_MODULE_CATEGORY_LABELS,
  VENDOR_PACKAGE_PRICE_UNIT_LABELS,
} from "@/lib/constants";
import { formatINR, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { PackageStatusControl } from "./_components/package-status-control";

// ============================================================
// Metadata
// ============================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await getPackage(id);
  if (!res.success) return { title: "Package not found" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = res.data as any;
  return { title: `${pkg.name} — Vendors & Packages` };
}

// ============================================================
// Color maps
// ============================================================

const PACKAGE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  ACTIVE:
    "bg-success/12 text-success border-success/25",
  ARCHIVED:
    "bg-slate-500/12 text-slate-600 border-slate-500/20 dark:text-slate-300",
};

const CATEGORY_HUE: Record<string, string> = {
  decor: "bg-pink-500/12 text-pink-700 border-pink-500/25 dark:text-pink-300",
  catering: "bg-amber-500/14 text-amber-700 border-amber-500/25 dark:text-amber-300",
  emcee: "bg-violet-500/12 text-violet-700 border-violet-500/25 dark:text-violet-300",
  photography: "bg-indigo-500/12 text-indigo-700 border-indigo-500/25 dark:text-indigo-300",
  av_lighting: "bg-orange-500/12 text-orange-700 border-orange-500/25 dark:text-orange-300",
  entertainment: "bg-rose-500/12 text-rose-700 border-rose-500/25 dark:text-rose-300",
};

// ============================================================
// Detail page
// ============================================================

interface PackageDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PackageDetailPage({
  params,
}: PackageDetailPageProps) {
  const { id } = await params;

  const res = await getPackage(id);
  if (!res.success) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = res.data as any;

  const coverImage =
    pkg.images.find((i: { id: string }) => i.id === pkg.coverImageId) ??
    pkg.images[0] ??
    null;

  const categoryLabel =
    VENDOR_MODULE_CATEGORY_LABELS[pkg.category] ?? pkg.category;

  const priceUnitLabel =
    VENDOR_PACKAGE_PRICE_UNIT_LABELS[pkg.priceUnit] ?? pkg.priceUnit;

  return (
    <div className="space-y-6">
      {/* Header breadcrumb */}
      <PageHeader
        icon={PackageIcon}
        accent="teal"
        eyebrow={
          <span className="flex items-center gap-1">
            <Link
              href="/vendors"
              className="hover:text-foreground transition-colors"
            >
              Vendors &amp; Packages
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>Package</span>
          </span>
        }
        title={pkg.name}
        description={`Offered by ${pkg.vendor.name}`}
      >
        <Button asChild size="sm" className="h-9 gap-1.5 text-body">
          <Link href={`/vendors/packages/${id}/edit`}>
            <EditIcon className="size-3.5" />
            Edit package
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Main content ── */}
        <div className="space-y-6">
          {/* Hero image */}
          <div className="relative h-56 w-full overflow-hidden rounded-2xl border bg-muted shadow-card sm:h-72">
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage.url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-teal-500/10 via-muted to-muted">
                <ImageIcon className="size-10 text-muted-foreground/50" />
                <span className="text-meta font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
                  No photos on this package yet
                </span>
              </div>
            )}

            {/* Scrim — only meaningful over a real photo */}
            {coverImage && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            )}

            {/* Category chip */}
            <span
              className={cn(
                "absolute left-4 top-4 inline-flex items-center rounded-full border px-2.5 py-1 text-detail font-semibold backdrop-blur-md",
                CATEGORY_HUE[pkg.category] ??
                  "border-border bg-background/85 text-foreground"
              )}
            >
              {categoryLabel}
            </span>

            {/* Price badge — over the photo only; the sidebar carries it otherwise */}
            {coverImage && (
              <div className="absolute bottom-4 left-4">
                <p className="numeric text-h2 font-semibold leading-none tracking-[-0.02em] text-white drop-shadow-md">
                  {formatINR(pkg.price)}
                </p>
                <p className="mt-1 text-body font-medium text-white/80">
                  {priceUnitLabel}
                </p>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {pkg.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pkg.images.map(
                (img: { id: string; url: string; sortOrder: number }) => (
                  <div
                    key={img.id}
                    className={cn(
                      "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border bg-muted",
                      img.id === (coverImage?.id ?? null)
                        ? "border-teal-400 ring-2 ring-teal-500"
                        : "border-border"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )
              )}
            </div>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              status={pkg.status}
              colorMap={PACKAGE_STATUS_COLORS}
              className="text-detail"
            />
            <span className="text-body text-muted-foreground">
              by{" "}
              <Link
                href={`/vendors/${pkg.vendor.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {pkg.vendor.name}
              </Link>
            </span>
          </div>

          {/* Description */}
          {pkg.description && (
            <p className="text-copy leading-relaxed text-muted-foreground">
              {pkg.description}
            </p>
          )}

          <Separator />

          {/* Sections & items */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <ListIcon className="size-4 text-muted-foreground" />
              <h2 className="text-lede font-semibold text-foreground">
                What's included
              </h2>
            </div>

            {pkg.sections.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center">
                <p className="text-copy font-medium text-foreground">
                  Nothing spelled out yet
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-body leading-relaxed text-muted-foreground">
                  Clients buy what they can picture. Add sections and items so
                  this package sells itself.
                </p>
              </div>
            ) : (
              pkg.sections.map(
                (section: {
                  id: string;
                  title: string;
                  items: {
                    id: string;
                    name: string;
                    type: string;
                    options: string[];
                    chooseCount: number | null;
                    notes: string | null;
                  }[];
                }) => (
                  <div
                    key={section.id}
                    className="space-y-3 rounded-2xl border bg-card p-4 shadow-card"
                  >
                    <h3 className="text-copy font-semibold text-foreground">
                      {section.title}
                    </h3>

                    <div className="space-y-3 pl-1">
                      {section.items.map((item) => (
                        <div key={item.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <CheckIcon className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                            <span className="text-body font-medium text-foreground">
                              {item.name}
                            </span>
                          </div>

                          {item.type === "FIXED" && (
                            <p className="ml-5.5 text-detail text-muted-foreground">
                              Included
                            </p>
                          )}

                          {item.type === "SINGLE_CHOICE" &&
                            item.options.length > 0 && (
                              <div className="ml-6 space-y-1">
                                <p className="text-meta font-medium text-muted-foreground uppercase tracking-wide">
                                  Choose one:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.options.map((opt: string, oi: number) => (
                                    <Badge
                                      key={oi}
                                      variant="outline"
                                      className="text-meta border-border/60 bg-muted/50"
                                    >
                                      {opt}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                          {item.type === "MULTI_CHOICE" &&
                            item.options.length > 0 && (
                              <div className="ml-6 space-y-1">
                                <p className="text-meta font-medium text-muted-foreground uppercase tracking-wide">
                                  Choose {item.chooseCount ?? 1}:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.options.map((opt: string, oi: number) => (
                                    <Badge
                                      key={oi}
                                      variant="outline"
                                      className="text-meta border-border/60 bg-muted/50"
                                    >
                                      {opt}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                          {item.notes && (
                            <p className="ml-6 text-meta italic text-muted-foreground">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Price card */}
          <div className="space-y-1 rounded-2xl border bg-card p-5 shadow-card">
            <p className="text-meta font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Package price
            </p>
            <p className="numeric text-h1 font-semibold leading-tight tracking-[-0.02em] text-foreground">
              {formatINR(pkg.price)}
            </p>
            <p className="text-body text-muted-foreground">{priceUnitLabel}</p>
          </div>

          {/* Stats */}
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <dl className="space-y-3 text-body">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Sections</dt>
                <dd className="numeric font-medium">{pkg.sections.length}</dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Items</dt>
                <dd className="numeric font-medium">
                  {pkg.sections.reduce(
                    (a: number, s: { items: unknown[] }) => a + s.items.length,
                    0
                  )}
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Images</dt>
                <dd className="numeric font-medium">{pkg.images.length}</dd>
              </div>
            </dl>
          </div>

          {/* Status control */}
          <PackageStatusControl
            packageId={id}
            currentStatus={pkg.status}
          />
        </div>
      </div>
    </div>
  );
}
