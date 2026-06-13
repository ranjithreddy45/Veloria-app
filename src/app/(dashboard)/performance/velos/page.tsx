import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getPersonalPace, getTeamTarget, getIdentityProgress, getLeaderboard, getVelosConfig,
} from "@/actions/velos.actions";
import { getKudosFeed, getTeammates } from "@/actions/velos-peer.actions";
import { getQuests } from "@/actions/velos-quests.actions";
import { VelosSurface } from "./_components/velos-surface";

export const metadata: Metadata = { title: "Velos" };

export default async function VelosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const role = session.user.role ?? "";
  const canAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const [pace, team, identity, leaderboard, config, kudos, teammates, questData] = await Promise.all([
    getPersonalPace(), getTeamTarget(), getIdentityProgress(), getLeaderboard(), getVelosConfig(),
    getKudosFeed(), getTeammates(), getQuests(),
  ]);
  const configMetrics = (config as { eventType: string; label: string }[]).map((c) => ({ eventType: c.eventType, label: c.label }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Velos"
        eyebrow="Performance"
        description="Your progress, your pace, your journey — and how the team is doing together. Built so everyone moves, not just the top two."
      />
      <VelosSurface
        pace={pace as never}
        team={team as never}
        identity={identity as never}
        leaderboard={leaderboard.rows as never}
        config={config as never}
        myId={session.user.id}
        canAdmin={canAdmin}
        needsSeed={config.length === 0}
        kudosFeed={kudos.feed as never}
        kudosRemaining={kudos.remaining}
        teammates={teammates as never}
        quests={questData.quests as never}
        questsCanManage={questData.canManage}
        silverPlus={questData.silverPlus}
        configMetrics={configMetrics}
      />
    </div>
  );
}
