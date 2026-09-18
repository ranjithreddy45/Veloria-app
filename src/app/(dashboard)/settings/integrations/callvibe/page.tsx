import type { Metadata } from "next";

import { getCallVibeConfig } from "@/actions/callvibe.actions";
import { getCallVibePushSettings } from "@/actions/callvibe-push.actions";
import { PageHeader } from "@/components/layout/page-header";

import { CallVibeConfigForm } from "./_components/callvibe-config-form";
import { CallVibePushSection } from "./_components/callvibe-push-section";

export const metadata: Metadata = { title: "CallVibe Integration" };

export default async function CallVibeSettingsPage() {
  const [result, push] = await Promise.all([getCallVibeConfig(), getCallVibePushSettings()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CallVibe"
        description="Import recorded, transcribed and scored calls from CallVibe into each contact's timeline, and push leads out so agents can call them."
      />
      <CallVibeConfigForm initialConfig={result.success ? result.data : null} />
      <CallVibePushSection initial={push.success ? push.data : null} />
    </div>
  );
}
