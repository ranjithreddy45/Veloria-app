import { requireGuest } from "@/lib/guest-session";
import { getGuestRewards } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, Card, EmptyNote, SectionTitle } from "../../_components/ui";
import { fmtDate } from "../../_components/format";
import { Perks, ReferralForm } from "./_components/rewards-client";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { BRONZE: "Bronze member", SILVER: "Silver member", GOLD: "Gold member", PLATINUM: "Platinum member" };

export default async function RewardsPage() {
  const user = await requireGuest("/app/rewards");
  const r = await getGuestRewards();

  return (
    <Screen className="gap-[18px]">
      <ScreenHeader title="Rewards" backHref="/app/account" />
      {!r ? <EmptyNote>Rewards begin with your first booking. Hold a date and your account opens automatically.</EmptyNote> : (
        <>
          <div className="vg-gold-card relative overflow-hidden rounded-[22px] px-5 py-[22px]">
            <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-[#e8b631]/30 blur-[28px]" />
            <div className="relative">
              <div className="flex items-center justify-between"><span className="text-[10.5px] font-bold uppercase tracking-[.14em] text-[#b88513]">{TIER_LABEL[r.tier] ?? r.tier}</span><span className="font-editorial text-body italic text-[#8a6a1a]">{user.name}</span></div>
              <div className="mt-3 flex items-baseline gap-2"><span className="numeric text-[46px] font-semibold leading-none tracking-[-.025em]">{r.points.toLocaleString("en-IN")}</span><span className="text-body text-[#6e6e73]">points</span></div>
              <div className="mt-3 text-meta text-[#8a6a1a]">{r.totalEarned.toLocaleString("en-IN")} earned to date</div>
            </div>
          </div>

          <div>
            <SectionTitle title="Redeem" />
            <p className="mt-1 text-meta text-[#6e6e73]">Choose a perk and your coordinator applies it to your booking and confirms.</p>
            <Perks points={r.points} bookingId={r.bookingId} />
          </div>

          <ReferralForm referrals={r.referrals} />

          {r.activity.length > 0 && (
            <div>
              <SectionTitle title="Recent activity" />
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {r.activity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1"><div className="truncate text-body font-medium">{a.what}</div><div className="numeric text-meta text-[#8a8a8e]">{fmtDate(a.when, { day: "numeric", month: "short", year: "numeric" })}</div></div>
                    <div className={`numeric text-body font-semibold ${a.pts >= 0 ? "text-[#2a9d4a]" : "text-[#6e6e73]"}`}>{a.pts >= 0 ? `+${a.pts.toLocaleString("en-IN")}` : a.pts.toLocaleString("en-IN")}</div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </>
      )}
    </Screen>
  );
}
