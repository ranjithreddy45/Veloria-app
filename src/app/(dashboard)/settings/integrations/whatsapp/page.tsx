import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getWhatsAppTemplates, getSyncedWhatsAppTemplates } from "@/actions/whatsapp.actions";
import { getWhatsAppConfig } from "@/actions/whatsapp-config.actions";
import { WhatsAppConfigForm } from "./_components/whatsapp-config-form";
import { WhatsAppTemplateList } from "./_components/whatsapp-template-list";
import { SyncedTemplates } from "./_components/synced-templates";

export const metadata: Metadata = { title: "WhatsApp Integration" };

// ============================================================
// WhatsApp Integration Settings Page
// ============================================================

export default async function WhatsAppIntegrationPage() {
  const [templatesResult, configResult, syncedResult] = await Promise.all([
    getWhatsAppTemplates(),
    getWhatsAppConfig(),
    getSyncedWhatsAppTemplates(),
  ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const config = configResult.success ? configResult.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Business"
        description="Configure WhatsApp Business API for sending messages and notifications."
      />

      <WhatsAppConfigForm initialConfig={config ?? null} />

      {/* Meta's real list, above the hand-maintained one: what CAN be sent
          should outrank what a developer last typed into an array. */}
      <SyncedTemplates templates={syncedResult.success ? syncedResult.data : []} />

      <WhatsAppTemplateList templates={templates} />
    </div>
  );
}
