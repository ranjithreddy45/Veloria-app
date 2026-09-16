import type { Metadata } from "next";

import { getCallVibeConfig } from "@/actions/callvibe.actions";
import { PageHeader } from "@/components/layout/page-header";

import { CallVibeConfigForm } from "./_components/callvibe-config-form";

export const metadata: Metadata = { title: "CallVibe Integration" };

export default async function CallVibeSettingsPage() {
  const result = await getCallVibeConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        title="CallVibe"
        description="Import recorded, transcribed and scored calls from CallVibe into each contact's timeline, and push leads out so agents can call them."
      />
      <CallVibeConfigForm initialConfig={result.success ? result.data : null} />
    </div>
  );
}
