import type { Metadata } from "next";
import { UserCheckIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AssignmentRulesManager } from "./_components/assignment-rules-manager";
import { emailDeliveryConfigured } from "@/lib/crm/lead-assigned-email";

export const metadata: Metadata = { title: "Assignment Rules" };

export default function AssignmentRulesPage() {
  const emailOn = emailDeliveryConfigured();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Automation"
        icon={UserCheckIcon}
        accent="blue"
        title="Lead Auto-Assignment"
        description="Route incoming leads to the right owner automatically — by source, event type or estimated value. Rules are evaluated in priority order and the first match wins."
      />
      {/*
        Say it out loud when assignment emails cannot be delivered.

        Every email in this app currently returns "Email not configured"
        because RESEND_API_KEY is unset — silently, from inside a catch. Someone
        setting up auto-assignment would reasonably assume the notification half
        works, and would find out only when a rep missed a lead. A rule screen
        that promises notifications owes the truth about whether they send.
      */}
      {!emailOn && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-body">
          <span className="font-semibold text-foreground">
            Assignment emails are not being delivered.
          </span>{" "}
          <span className="text-foreground/80">
            Leads will still be allocated and the in-app notification still
            appears, but no email is sent because no mail provider key
            (<code>RESEND_API_KEY</code>) is configured for this deployment. Add
            it in the hosting environment settings to switch these on.
          </span>
        </div>
      )}

      <AssignmentRulesManager />
    </div>
  );
}
