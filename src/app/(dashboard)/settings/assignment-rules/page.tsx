import type { Metadata } from "next";
import { UserCheckIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AssignmentRulesManager } from "./_components/assignment-rules-manager";

export const metadata: Metadata = { title: "Assignment Rules" };

export default function AssignmentRulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Automation"
        icon={UserCheckIcon}
        accent="blue"
        title="Lead Auto-Assignment"
        description="Route incoming leads to the right owner automatically — by source, event type or estimated value. Rules are evaluated in priority order and the first match wins."
      />
      <AssignmentRulesManager />
    </div>
  );
}
