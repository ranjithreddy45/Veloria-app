import { getAutoWelcomeConfigs } from "@/actions/auto-welcome.actions";
import { getLeadCaptureConfigs } from "@/actions/lead-capture-config.actions";
import { listApiKeys } from "@/actions/api-key.actions";
import { PageHeader } from "@/components/layout/page-header";
import { LeadCaptureConfig } from "./_components/lead-capture-config";
import { AutoWelcomeConfig } from "./_components/auto-welcome-config";
import { Webhook } from "lucide-react";

export const metadata = {
  title: "Lead Capture Integration",
};

export default async function LeadCapturePage() {
  const [welcomeConfigsResult, leadConfigsResult, apiKeysResult] = await Promise.all([
    getAutoWelcomeConfigs(),
    getLeadCaptureConfigs(),
    listApiKeys(),
  ]);

  const welcomeConfigs = welcomeConfigsResult.success ? welcomeConfigsResult.data : [];

  // Map lead capture configs to plain objects for client component
  const leadConfigs =
    leadConfigsResult.success && leadConfigsResult.data
      ? leadConfigsResult.data.map((c) => ({
          id: c.id,
          platform: c.platform,
          credentials: (c.credentials || {}) as Record<string, string>,
          isActive: c.isActive,
          lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
        }))
      : [];

  // Map API keys to plain objects
  const apiKeys =
    apiKeysResult.success && apiKeysResult.data
      ? apiKeysResult.data.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          isActive: k.isActive,
          lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : null,
          createdAt: new Date(k.createdAt).toISOString(),
        }))
      : [];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Integrations"
        icon={Webhook}
        accent="cyan"
        title="Lead Capture"
        description="Connect the platforms that send you leads. Store each platform's credentials, mint API keys, and hand out the webhook URLs that drop enquiries straight into your pipeline."
      />

      <LeadCaptureConfig baseUrl={baseUrl} configs={leadConfigs} apiKeys={apiKeys} />

      <AutoWelcomeConfig initialConfigs={welcomeConfigs} />
    </div>
  );
}
