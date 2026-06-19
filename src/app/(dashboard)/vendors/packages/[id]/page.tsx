import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  EditIcon,
  ImageIcon,
  CheckIcon,
  ChevronRightIcon,
  ListIcon,
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
  DRAFT:
    "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  ACTIVE:
    "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  ARCHIVED:
    "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
};

const CATEGORY_HUE: Record<string, string> = {
  decor: "bg-pink-50 text-pink-700 border-pink-200/80",
  catering: "bg-amber-50 text-amber-700 border-amber-200/80",
  emcee: "bg-violet-50 text-violet-700 border-violet-200/80",
  photography: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  av_lighting: "bg-orange-50 text-orange-700 border-orange-200/80",
  entertainment: "bg-rose-50 text-rose-700 border-rose-200/80",
};

const COVER_GRADIENT: Record<string, string> = {
  decor: "from-pink-400/80 to-rose-600/80",
  catering: "from-amber-400/80 to-orange-600/80",
  emcee: "from-violet-400/80 to-purple-600/80",
  photography: "from-indigo-400/80 to-blue-600/80",
  av_lighting: "from-orange-400/80 to-red-600/80",
  entertainment: "from-rose-400/80 to-pink-600/80",
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

  const gradient =
    COVER_GRADIENT[pkg.category] ?? "from-violet-400/80 to-indigo-600/80";

  const categoryLabel =
    VENDOR_MODULE_CATEGORY_LABELS[pkg.category] ?? pkg.category;

  const priceUnitLabel =
    VENDOR_PACKAGE_PRICE_UNIT_LABELS[pkg.priceUnit] ?? pkg.priceUnit;

  return (
    <div className="space-y-6">
      {/* Header breadcrumb */}
      <PageHeader
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
      >
        <Button asChild size="sm" className="h-9 gap-1.5 text-[13px]">
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
          <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-border/60 bg-muted sm:h-72">
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage.url}
                alt={pkg.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center bg-gradient-to-br",
                  gradient
                )}
              >
                <ImageIcon className="size-14 text-white/50" />
              </div>
            )}

            {/* Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

            {/* Category chip */}
            <span
              className={cn(
                "absolute left-4 top-4 inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold backdrop-blur-sm",
                CATEGORY_HUE[pkg.category] ??
                  "bg-white/90 text-foreground border-border"
              )}
            >
              {categoryLabel}
            </span>

            {/* Price badge */}
            <div className="absolute bottom-4 left-4">
              <p className="text-[28px] font-bold tabular-nums leading-none text-white drop-shadow-md">
                {formatINR(pkg.price)}
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-white/80">
                {priceUnitLabel}
              </p>
            </div>
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
                        ? "ring-2 ring-violet-500 border-violet-400"
                        : "border-border/60"
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
              className="text-[12px]"
            />
            <span className="text-[13px] text-muted-foreground">
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
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {pkg.description}
            </p>
          )}

          <Separator />

          {/* Sections & items */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <ListIcon className="size-4 text-muted-foreground" />
              <h2 className="text-[16px] font-semibold text-foreground">
                What's included
              </h2>
            </div>

            {pkg.sections.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No sections defined.
              </p>
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
                    className="rounded-2xl border border-border/60 bg-card p-4 space-y-3"
                  >
                    <h3 className="text-[14px] font-semibold text-foreground">
                      {section.title}
                    </h3>

                    <div className="space-y-3 pl-1">
                      {section.items.map((item) => (
                        <div key={item.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <CheckIcon className="size-3.5 text-violet-500 shrink-0" />
                            <span className="text-[13px] font-medium text-foreground">
                              {item.name}
                            </span>
                          </div>

                          {item.type === "FIXED" && (
                            <p className="ml-5.5 text-[12px] text-muted-foreground">
                              Included
                            </p>
                          )}

                          {item.type === "SINGLE_CHOICE" &&
                            item.options.length > 0 && (
                              <div className="ml-6 space-y-1">
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                  Choose one:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.options.map((opt: string, oi: number) => (
                                    <Badge
                                      key={oi}
                                      variant="outline"
                                      className="text-[11px] border-border/60 bg-muted/50"
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
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                  Choose {item.chooseCount ?? 1}:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.options.map((opt: string, oi: number) => (
                                    <Badge
                                      key={oi}
                                      variant="outline"
                                      className="text-[11px] border-border/60 bg-muted/50"
                                    >
                                      {opt}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                          {item.notes && (
                            <p className="ml-6 text-[11px] italic text-muted-foreground">
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
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card space-y-1">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Package price
            </p>
            <p className="text-[32px] font-bold tabular-nums leading-tight text-foreground">
              {formatINR(pkg.price)}
            </p>
            <p className="text-[13px] text-muted-foreground">{priceUnitLabel}</p>
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
            <dl className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Sections</dt>
                <dd className="font-medium tabular-nums">
                  {pkg.sections.length}
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Items</dt>
                <dd className="font-medium tabular-nums">
                  {pkg.sections.reduce(
                    (a: number, s: { items: unknown[] }) => a + s.items.length,
                    0
                  )}
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Images</dt>
                <dd className="font-medium tabular-nums">
                  {pkg.images.length}
                </dd>
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
