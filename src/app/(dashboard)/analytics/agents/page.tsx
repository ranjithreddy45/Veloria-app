import { getAgentActivity } from "@/actions/agent-activity.actions";
import { AgentActivityDashboard } from "./_components/agent-activity-dashboard";
import { UserCog } from "lucide-react";

export const metadata = {
  title: "Agent Activity | Veloria Grand",
};

export default async function AgentActivityPage() {
  const result = await getAgentActivity({});
  const agents = result.success ? result.data : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" />
          Agent Activity
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor agent performance and call activity
        </p>
      </div>

      <AgentActivityDashboard initialData={agents} />
    </div>
  );
}
