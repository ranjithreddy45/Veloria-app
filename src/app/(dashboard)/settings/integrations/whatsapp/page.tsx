import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getWhatsAppTemplates } from "@/actions/whatsapp.actions";
import { WhatsAppConfigForm } from "./_components/whatsapp-config-form";
import { WhatsAppTemplateList } from "./_components/whatsapp-template-list";

export const metadata: Metadata = { title: "WhatsApp Integration" };

// ============================================================
// WhatsApp Integration Settings Page
// ============================================================

export default async function WhatsAppIntegrationPage() {
  const templatesResult = await getWhatsAppTemplates();

  const templates = templatesResult.success ? templatesResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Business"
        description="Configure WhatsApp Business API for sending messages and notifications."
      />

      <WhatsAppConfigForm />

      <WhatsAppTemplateList templates={templates} />
    </div>
  );
}
