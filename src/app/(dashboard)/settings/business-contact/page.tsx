import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Phone } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getBusinessContactSettings } from "@/actions/business-profile.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BusinessContactForm } from "./_components/business-contact-form";

export const metadata: Metadata = { title: "Business Contact | Settings" };
export const dynamic = "force-dynamic";

// ============================================================
// /settings/business-contact — the phone, WhatsApp, email, address and
// support hours the customer app shows. One BusinessProfile row, read by every
// customer screen through getPublicContact(). Gated like Settings → Venues
// (settings:venues); the actions re-check it.
// ============================================================

export default async function BusinessContactPage() {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "settings:venues")) redirect("/not-authorized");

  const res = await getBusinessContactSettings();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Business Contact"
        eyebrow="Settings · Customer app"
        icon={Phone}
        accent="emerald"
        description="How customers reach you. The customer app's WhatsApp, Call and Email buttons, the address and your team hours all read this one record — change it here and every customer screen follows."
      />
      {res.success ? (
        <BusinessContactForm profile={res.data.profile} live={res.data.live} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{res.error}</CardContent>
        </Card>
      )}
    </div>
  );
}
