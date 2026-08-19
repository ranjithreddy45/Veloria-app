import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getGadsSettings } from "@/actions/gads-config.actions";
import { GadsSettingsForm } from "./_components/gads-settings-form";

export const metadata: Metadata = { title: "Google Ads — Lead quality" };
export const dynamic = "force-dynamic";

export default async function GoogleAdsSettingsPage() {
  const res = await getGadsSettings();
  const data = res.success ? res.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Marketing"
        title="Google Ads — lead quality"
        description="Value per qualified lead by event type, and the API key the offline-conversion uploader uses to pull qualified leads and bookings back to Google."
      />
      {data ? (
        <GadsSettingsForm
          buckets={data.buckets}
          hasApiKey={data.hasApiKey}
          apiKeyMasked={data.apiKeyMasked}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {res.success ? "No settings." : res.error}
        </p>
      )}
    </div>
  );
}
