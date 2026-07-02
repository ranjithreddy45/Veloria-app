import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProcessFlows } from "./_components/process-flow";

export const metadata: Metadata = { title: "Playbook · Process Map" };

export default function PlaybookPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Guide"
        title="Playbook — how Veloria Grand runs"
        description="A friendly, plain-language map of every major flow: who does what, what the system automates, and where approvals kick in."
      />
      <ProcessFlows />
    </div>
  );
}
