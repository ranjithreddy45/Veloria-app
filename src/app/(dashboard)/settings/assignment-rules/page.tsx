import type { Metadata } from "next";
import { AssignmentRulesManager } from "./_components/assignment-rules-manager";

export const metadata: Metadata = { title: "Assignment Rules" };

export default function AssignmentRulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Lead Auto-Assignment Rules
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create rules to automatically assign incoming leads to team members
          based on criteria like source, event type, or estimated value.
        </p>
      </div>
      <AssignmentRulesManager />
    </div>
  );
}
