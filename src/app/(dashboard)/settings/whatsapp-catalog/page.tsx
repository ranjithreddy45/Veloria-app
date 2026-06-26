import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getCatalogConfig } from "@/actions/whatsapp-catalog.actions";
import { CatalogConfigForm } from "./catalog-config-form";

export const metadata: Metadata = {
  title: "WhatsApp Catalog Settings",
  description: "Configure the first-inbound auto-catalog event types and brochure links",
};

// ============================================================
// Admin config surface (Server Component) — gated settings:read; editing
// requires settings:update. Renders the canonical event-type map (labels,
// brochure slugs, food tiers) and the enable flag. Config persistence is
// additive (env flag + canonical content); the form previews and validates.
// ============================================================

export default async function WhatsAppCatalogSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!hasPermission(session.user.role as string, "settings:read")) {
    redirect("/not-authorized");
  }

  const canEdit = hasPermission(session.user.role as string, "settings:update");
  const configRes = await getCatalogConfig();
  const config = configRes.success ? configRes.data : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="SETTINGS · WHATSAPP CATALOG"
        title="Auto-Catalog"
        description="When an unknown number first messages your WhatsApp Business line, we auto-reply with an event-type picker and send tailored package cards. Configure the options and brochure links here."
      />

      {config ? (
        <CatalogConfigForm config={config} canEdit={canEdit} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {configRes.success ? "No config available." : configRes.error}
        </p>
      )}
    </div>
  );
}
