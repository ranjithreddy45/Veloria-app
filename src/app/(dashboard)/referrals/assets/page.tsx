import type { Metadata } from "next";
import Link from "next/link";
import {
  ImageIcon,
  VideoIcon,
  FileTextIcon,
  ShareIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
} from "lucide-react";

import { getReferralAssets } from "@/actions/referral-engine.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { AddAssetDialog, DeleteAssetButton } from "./_components/asset-actions";

export const metadata: Metadata = {
  title: "Referral Assets",
};

// ============================================================
// Asset Type Config
// ============================================================

const ASSET_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  IMAGE: {
    label: "Image",
    icon: <ImageIcon className="size-4" />,
    color:
      "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400",
  },
  VIDEO: {
    label: "Video",
    icon: <VideoIcon className="size-4" />,
    color:
      "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400",
  },
  FLYER: {
    label: "Flyer",
    icon: <FileTextIcon className="size-4" />,
    color:
      "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400",
  },
  SOCIAL_CARD: {
    label: "Social Card",
    icon: <ShareIcon className="size-4" />,
    color:
      "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
};

// ============================================================
// Referral Assets Page
// ============================================================

export default async function ReferralAssetsPage() {
  const result = await getReferralAssets();
  const assets = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral Assets"
        description="Shareable marketing assets for your referral program."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/referrals/dashboard">
              <ArrowLeftIcon className="mr-2 size-4" />
              Dashboard
            </Link>
          </Button>
          <AddAssetDialog />
        </div>
      </PageHeader>

      {assets.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ImageIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No assets yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Add shareable images, videos, and flyers for your referral
              partners.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {assets.map((asset: any) => {
            const typeConfig = ASSET_TYPE_CONFIG[asset.type] || {
              label: asset.type,
              icon: <FileTextIcon className="size-4" />,
              color: "",
            };
            const isImage =
              asset.type === "IMAGE" || asset.type === "SOCIAL_CARD";

            return (
              <Card
                key={asset.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm overflow-hidden"
              >
                {/* Preview */}
                {isImage && asset.fileUrl && (
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.fileUrl}
                      alt={asset.title}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                {!isImage && (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <div className="text-muted-foreground/40">
                      {typeConfig.icon}
                    </div>
                  </div>
                )}

                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{asset.title}</p>
                      <Badge
                        variant="outline"
                        className={`mt-1 gap-1 text-xs ${typeConfig.color}`}
                      >
                        {typeConfig.icon}
                        {typeConfig.label}
                      </Badge>
                    </div>
                    <DeleteAssetButton assetId={asset.id} />
                  </div>

                  {asset.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {asset.description}
                    </p>
                  )}

                  <div className="mt-3">
                    <a
                      href={asset.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLinkIcon className="size-3" />
                      Open File
                    </a>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Added{" "}
                    {new Date(asset.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
