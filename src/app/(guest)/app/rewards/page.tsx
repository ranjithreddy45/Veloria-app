import { requireGuest } from "@/lib/guest-session";
import { CUSTOMER_REQUEST_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { getGuestRewardsDetails, requestGuestRedemption, submitGuestFriendReferral } from "@/actions/guest-account.actions";
import { Screen, ScreenHeader, Card, EmptyNote, SectionTitle, ProgressBar, Pill } from "../../_components/ui";
import { fmtDate } from "../../_components/format";
import { CopyLink, IntroduceFriend, RedeemPoints } from "./_components/rewards-client";
import { referralStatusWord, tierName, type RedemptionBlock } from "./_lib/perks";

export const dynamic = "force-dynamic";

const REDEMPTION_BLOCKED: Record<RedemptionBlock, string> = {
  PREVIEW: "Staff preview: requests to use points come from the host's own account.",
  NO_BOOKING: "Points are used on a booking, so you can ask once one of your own bookings is linked to this sign-in.",
  NO_POINTS: "You don't have points to use yet.",
  OPEN_REQUEST: "Your coordinator is still confirming your last request. You can ask again once it's settled.",
};

function signed(points: number): string {
  if (points > 0) return `+${points.toLocaleString("en-IN")}`;
  if (points < 0) return `−${Math.abs(points).toLocaleString("en-IN")}`;
  return "0";
}

export default async function RewardsPage() {
  await requireGuest("/app/rewards");
  const r = await getGuestRewardsDetails();

  if (!r || (!r.linked && !r.preview)) {
    return (
      <Screen className="gap-[18px]">
        <ScreenHeader title="Rewards" backHref="/app/account" />
        <EmptyNote>
          Rewards belong to a booking. Once one of your bookings is linked to this sign-in, your points and the friends you introduce show here.
        </EmptyNote>
      </Screen>
    );
  }

  const loyalty = r.loyalty;

  return (
    <Screen className="gap-[18px]">
      <ScreenHeader title="Rewards" backHref="/app/account" />

      {r.preview && (
        <p className="rounded-2xl bg-[#fdf3e1] px-4 py-3 text-detail leading-[1.5] text-[#8a5a00]">
          Staff preview of the host&apos;s rewards, limited to what your role can see in the team app. Nothing here can be changed.
          {r.loyaltyHidden ? " Loyalty is hidden for your role." : ""}
          {r.referralsHidden ? " Referrals are hidden for your role." : ""}
        </p>
      )}

      {!r.loyaltyHidden &&
        (loyalty ? (
          <div className="vg-gold-card relative overflow-hidden rounded-[22px] px-5 py-[22px]">
            <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-[#e8b631]/30 blur-[28px]" />
            <div className="relative">
              <span className="text-[10.5px] font-bold uppercase tracking-[.14em] text-[#b88513]">{tierName(loyalty.tier)} member</span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="numeric text-[46px] font-semibold leading-none tracking-[-.025em]">{loyalty.points.toLocaleString("en-IN")}</span>
                <span className="text-body text-[#6e6e73]">points</span>
              </div>
              {loyalty.progress.nextTier ? (
                <div className="mt-4">
                  <ProgressBar pct={loyalty.progress.pct} className="h-1.5" track="bg-[#b88513]/[.18]" fill="bg-[#b88513]" />
                  <div className="mt-2 flex justify-between text-meta font-semibold uppercase tracking-[.08em] text-[#8a8a8e]">
                    <span>{tierName(loyalty.tier)}</span>
                    <span>
                      {loyalty.progress.toGo.toLocaleString("en-IN")} to {tierName(loyalty.progress.nextTier)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-meta text-[#8a6a1a]">Top tier · {loyalty.totalEarned.toLocaleString("en-IN")} earned to date</div>
              )}
            </div>
          </div>
        ) : (
          <EmptyNote>No points yet. The team adds points to your account, and they show here as soon as they do.</EmptyNote>
        ))}

      {!r.loyaltyHidden && (loyalty || r.redemptions.length > 0) && (
        <div>
          <SectionTitle title="Use your points" />
          <p className="mt-1 text-meta leading-[1.5] text-[#6e6e73]">
            Points don&apos;t have a fixed price list. Tell your coordinator what you&apos;d like to use them for: they confirm what&apos;s possible,
            and points come off your balance only when they apply it.
          </p>
          {r.canRequestRedemption && r.bookingId && loyalty ? (
            <RedeemPoints bookingId={r.bookingId} balance={loyalty.points} action={requestGuestRedemption} />
          ) : r.redemptionBlockedReason ? (
            <p className="mt-2 text-meta text-[#6e6e73]">{REDEMPTION_BLOCKED[r.redemptionBlockedReason]}</p>
          ) : null}
          {r.redemptions.length > 0 && (
            <Card className="vg-divide mt-2.5 overflow-hidden">
              {r.redemptions.map((x) => (
                <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-body">{x.text}</div>
                    <div className="numeric text-meta text-[#8a8a8e]">{fmtDate(x.createdAt, { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <Pill tone={x.status === "DONE" ? "green" : "plum"}>{customerLabel(CUSTOMER_REQUEST_STATUS_LABEL, x.status)}</Pill>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {!r.referralsHidden && (
        <div className="flex flex-col gap-2.5">
          <SectionTitle title="Introduce a friend" />
          {!r.rulesHidden &&
            (r.referralRewards.length > 0 ? (
              <Card className="vg-divide overflow-hidden">
                {r.referralRewards.map((p) => (
                  <div key={p.id} className="flex items-center gap-3.5 px-4 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#faf3e1]">
                      <span className="size-3.5 rotate-45 rounded-[4px] bg-[#b88513]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold">{p.reward}</div>
                      <div className="text-meta leading-[1.45] text-[#6e6e73]">{p.condition}</div>
                    </div>
                  </div>
                ))}
                <p className="px-4 py-3 text-meta leading-[1.5] text-[#6e6e73]">
                  The team records a reward when your friend&apos;s booking is confirmed, then applies it and lets you know.
                </p>
              </Card>
            ) : (
              <p className="text-meta leading-[1.5] text-[#6e6e73]">
                There are no referral rewards set up right now. The team still looks after everyone you introduce.
              </p>
            ))}
          {r.partner && (
            <Card className="px-4 py-3.5">
              <div className="text-body font-semibold">Your referral link</div>
              {r.partner.reward && <div className="mt-0.5 text-meta leading-[1.45] text-[#6e6e73]">{r.partner.reward}</div>}
              <CopyLink url={r.partner.url} />
            </Card>
          )}
          <IntroduceFriend disabled={r.preview} action={submitGuestFriendReferral} />
          {r.referrals.length > 0 && (
            <Card className="vg-divide overflow-hidden">
              {r.referrals.map((x) => (
                <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-medium">{x.name}</div>
                    <div className="numeric text-meta text-[#8a8a8e]">{fmtDate(x.createdAt, { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <span className="rounded-full bg-[#f7eef2] px-2.5 py-1 text-meta font-semibold text-[#6d1b52]">{referralStatusWord(x.status)}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {!r.loyaltyHidden && loyalty && loyalty.activity.length > 0 && (
        <div>
          <SectionTitle title="Recent activity" />
          <Card className="vg-divide mt-2.5 overflow-hidden">
            {loyalty.activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-medium">{a.what}</div>
                  <div className="numeric text-meta text-[#8a8a8e]">{fmtDate(a.when, { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
                <div className={`numeric text-body font-semibold ${a.points > 0 ? "text-[#2a9d4a]" : "text-[#6e6e73]"}`}>{signed(a.points)}</div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </Screen>
  );
}
