import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignForm } from "../_components/campaign-form";

export const metadata: Metadata = { title: "New Campaign" };

// ============================================================
// Create Campaign Page
// ============================================================

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Campaign"
        description="Create a new email marketing campaign."
      />
      <div className="mx-auto max-w-3xl">
        <CampaignForm />
      </div>
    </div>
  );
}
