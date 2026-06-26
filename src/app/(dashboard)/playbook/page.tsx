import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProcessFlows } from "./_components/process-flow";

export const metadata: Metadata = { title: "Playbook · Process Map" };

export default function PlaybookPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Company Playbook"
        title="How VeloriaApp works"
        description="The complete process map — every major flow in plain language. For each step you can see who does it, what happens, what the system does automatically, and where an approval is needed. Great for onboarding and for understanding how the funnel fits together."
      />
      <ProcessFlows />
    </div>
  );
}
