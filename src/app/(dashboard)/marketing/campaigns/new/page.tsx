import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";

import { MarketingCampaignForm } from "../_components/marketing-campaign-form";

export const metadata: Metadata = { title: "New Marketing Campaign" };

// ============================================================
// Create Marketing Campaign (marketing:manage)
// ============================================================

export default async function NewMarketingCampaignPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "marketing:manage")) {
    redirect("/not-authorized");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Marketing Campaign"
        description="Register a paid campaign so its spend feeds CAC and ROAS."
      />
      <div className="mx-auto max-w-3xl">
        <MarketingCampaignForm />
      </div>
    </div>
  );
}
