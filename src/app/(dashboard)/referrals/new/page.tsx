import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getReferrerContactOptions } from "@/actions/referral.actions";
import { ReferralForm } from "../_components/referral-form";

export const metadata: Metadata = { title: "New Referral" };

// ============================================================
// Create Referral Page
// ============================================================

export default async function NewReferralPage() {
  // Fetch contacts for the referrer selector via a permission-guarded
  // server action (requires both referrals:create and contacts:read).
  const result = await getReferrerContactOptions();

  if (!result.success) {
    notFound();
  }

  const contacts = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Referral"
        description="Record a new client referral."
      />
      <div className="mx-auto max-w-3xl">
        <ReferralForm contacts={contacts} />
      </div>
    </div>
  );
}
