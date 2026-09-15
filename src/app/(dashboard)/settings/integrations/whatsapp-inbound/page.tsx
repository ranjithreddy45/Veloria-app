import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { listWhatsAppInboundEvents } from "@/actions/whatsapp-inbound.actions";
import { InboundEventsViewer } from "./_components/inbound-events-viewer";

export const metadata: Metadata = { title: "WhatsApp Inbound Log" };
// Live webhook captures; must never be cached.
export const dynamic = "force-dynamic";

// ============================================================
// WhatsApp inbound log — what the provider actually sent us.
//
// Outbound via Weflux was confirmed working; the inbound webhook's payload
// shape and signature had never been validated against a real event, so a
// customer reply could be silently dropped and nobody would know. This page
// shows every webhook POST as it was received (redacted headers + raw body),
// whether it authenticated, whether we understood it, and which contact it
// landed on — and lets an admin replay a captured payload after a parser fix.
// ============================================================

export default async function WhatsAppInboundPage({
  searchParams,
}: {
  searchParams: Promise<{ problems?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session?.user || !hasPermission(role, "settings:read")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const problemsOnly = sp.problems === "1";
  const result = await listWhatsAppInboundEvents({ problemsOnly });
  const events = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Inbox}
        accent="emerald"
        eyebrow="Settings · Integrations"
        title="WhatsApp Inbound Log"
        description="Every webhook event Weflux or Meta delivered to this deployment — as received, with its auth result, parse outcome and contact match. Use it to prove that replies are being captured."
      />

      <InboundEventsViewer
        events={events}
        problemsOnly={problemsOnly}
        canReplay={hasPermission(role, "settings:update")}
        loadError={result.success ? null : result.error}
      />
    </div>
  );
}
