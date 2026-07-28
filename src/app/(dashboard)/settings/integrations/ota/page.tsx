import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Rss } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOtaChannels } from "@/actions/ota.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { OtaConfig } from "./_components/ota-config";

export const metadata: Metadata = {
  title: "OTA Syndication",
};

export default async function OtaSyndicationPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !hasPermission(role ?? "", "settings:read")) {
    redirect("/not-authorized");
  }

  // Writes require settings:update — drive the client's read-only mode off this.
  const canManage = hasPermission(role ?? "", "settings:update");

  const [channelsResult, venues] = await Promise.all([
    getOtaChannels(),
    prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const channels =
    channelsResult.success && channelsResult.data
      ? channelsResult.data.map((c) => ({
          id: c.id,
          channelType: c.channelType,
          name: c.name,
          feedFormat: c.feedFormat,
          feedToken: c.feedToken,
          inboundToken: c.inboundToken,
          venueId: c.venueId,
          defaultSource: c.defaultSource,
          fieldMapping: (c.fieldMapping || {}) as Record<string, string>,
          credentials: (c.credentials || {}) as Record<string, string>,
          isActive: c.isActive,
          lastOutboundSyncAt: c.lastOutboundSyncAt ? c.lastOutboundSyncAt.toISOString() : null,
          lastInboundSyncAt: c.lastInboundSyncAt ? c.lastInboundSyncAt.toISOString() : null,
        }))
      : [];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Integrations"
        icon={Rss}
        accent="pink"
        title="OTA Syndication"
        description="Publish per-venue availability feeds (JSON / iCal) to marketplaces and ingest leads back from aggregators. Feed and inbound URLs are tokenized — share each one only with its intended channel."
      >
        {!canManage && <StatusPill label="Read-only access" hue="amber" />}
      </PageHeader>

      <OtaConfig
        baseUrl={baseUrl}
        channels={channels}
        venues={venues}
        canManage={canManage}
      />
    </div>
  );
}
