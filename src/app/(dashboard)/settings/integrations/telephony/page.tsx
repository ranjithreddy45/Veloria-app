import type { Metadata } from "next";
import { getTelephonyConfig } from "@/actions/telephony.actions";
import { PageHeader } from "@/components/layout/page-header";
import { TelephonyConfigForm } from "./_components/telephony-config-form";

export const metadata: Metadata = { title: "Telephony Integration" };

export default async function TelephonySettingsPage() {
  const result = await getTelephonyConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloud Telephony"
        description="Configure your cloud telephony provider for click-to-call and automatic call recording."
      />
      <TelephonyConfigForm
        initialConfig={result.success ? result.data : null}
      />
    </div>
  );
}
