import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Rss } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOtaChannels } from "@/actions/ota.actions";
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Rss className="h-6 w-6 text-primary" />
          OTA Syndication
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Publish per-venue availability feeds (JSON / iCal) to marketplaces and ingest leads
          from aggregators. Public feed/inbound URLs are tokenized — share them only with the
          intended channel.
        </p>
      </div>

      <OtaConfig
        baseUrl={baseUrl}
        channels={channels}
        venues={venues}
        canManage={canManage}
      />
    </div>
  );
}
