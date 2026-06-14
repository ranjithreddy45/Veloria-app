import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAcqConfigValues } from "@/actions/acq-config.actions";
import { PageHeader } from "@/components/layout/page-header";
import { BdConfigForm } from "./_components/bd-config-form";

export const metadata: Metadata = { title: "BD CRM Config | Settings" };

// ============================================================
// BD / Acquisition CRM config — tunable floors + thresholds.
// Read is gated to BD managers/admins; the page itself only renders
// for those roles (otherwise getAcqConfigValues fails → redirect).
// The form's save action is further gated to ADMIN/SUPER_ADMIN only.
// ============================================================

export default async function BdConfigPage() {
  const res = await getAcqConfigValues();
  if (!res.success) redirect("/not-authorized");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="BD CRM Config"
        eyebrow="System · Acquisition"
        description="Tune the floors, SLAs and sign-off thresholds the BD/Acquisition deal engine enforces. Changes apply immediately — no redeploy. Only administrators can save."
      />
      <BdConfigForm initialValues={res.data} />
    </div>
  );
}
