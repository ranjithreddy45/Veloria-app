import { getAgentActivity } from "@/actions/agent-activity.actions";
import { PageHeader } from "@/components/layout/page-header";
import { AgentActivityDashboard } from "./_components/agent-activity-dashboard";
import { UserCog } from "lucide-react";

export const metadata = {
  title: "Agent Activity",
};

export default async function AgentActivityPage() {
  const result = await getAgentActivity({});
  const agents = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Analytics · Team"
        icon={UserCog}
        accent="blue"
        title="Agent Activity"
        description="Monitor agent performance and call activity across the sales floor."
      />

      <AgentActivityDashboard initialData={agents} />
    </div>
  );
}
