import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getHomeView } from "@/actions/home.actions";
import { getVelosHeaderSummary } from "@/actions/velos.actions";
import { getOnboardingProgress } from "@/actions/onboarding.actions";
import { GettingStarted } from "./_components/getting-started";
import { WelcomeTour } from "./_components/welcome-tour";
import { ActivityFeed } from "./_components/activity-feed";
import { HomeKpis } from "./_components/home-kpis";
import { AttentionFeed } from "./_components/attention-feed";
import { SideCard } from "./_components/side-card";

export const metadata: Metadata = { title: "Dashboard" };

// ============================================================
// Team home (Server Component).
//
// One screen, shaped by role: the greeting, four figures, the "Needs you now"
// feed and one side card all come from getHomeView(), which picks a lens for
// the role and gates every block on the permission its own module requires.
// This file only lays the result out; it holds no queries and no numbers of
// its own, so there is exactly one place a figure on this screen can come
// from.
// ============================================================

export default async function DashboardPage() {
  const [view, velos, onboarding] = await Promise.all([
    getHomeView(),
    getVelosHeaderSummary(),
    getOnboardingProgress(),
  ]);

  // No session, or a role without dashboard:read (clients, vendors). The
  // middleware and the dashboard layout normally catch both first. Deliberately
  // NOT a redirect to /sign-in: a signed-in visitor sent there is bounced
  // straight back here, which loops (see the middleware's session-less rule).
  if (!view) {
    return (
      <div className="mx-auto max-w-[62ch] py-10">
        <h1 className="text-h2 text-foreground">The team home is not available for this account.</h1>
        <p className="text-copy mt-2 text-foreground/75">
          Your role does not include the team dashboard. If that is unexpected, ask an administrator to check your role.
        </p>
      </div>
    );
  }

  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(view.asOf));

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-[18px]">
      {/* First-login orientation — self-gates via localStorage, shows once. */}
      <WelcomeTour />

      <header className="flex flex-col gap-1.5">
        <p className="text-meta font-semibold uppercase tracking-[0.1em] text-foreground/70">
          {today} · {view.lensLabel}
        </p>
        {/* The time-of-day greeting stays inside the h1: it is how people (and
            tests/e2e/smoke-routes) recognise this page. The second sentence is
            the point of it: one true, specific fact for this role. */}
        <h1 className="text-h2 sm:text-h1 max-w-[28ch] text-balance text-foreground sm:max-w-[34ch]">
          {view.greeting.salutation} {view.greeting.headline}
        </h1>
        <p className="text-copy max-w-[62ch] text-foreground/75">{view.greeting.lede}</p>
        {velos && velos.players > 0 && (
          <Link
            href="/performance/velos"
            className="text-detail mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary ring-1 ring-primary/20 ring-inset transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Trophy aria-hidden className="size-3.5" strokeWidth={2} />
            <span className="numeric">
              <span className="sr-only">Velos leaderboard: </span>
              {velos.rank ? `#${velos.rank} of ${velos.players}` : "Join the board"} · {velos.points} pts
            </span>
          </Link>
        )}
      </header>

      {view.degraded && (
        <p role="status" className="text-body rounded-[13px] bg-warning/15 px-3 py-2 text-foreground">
          Some figures could not be loaded just now, so they are left out below rather than guessed. Reload to try
          again.
        </p>
      )}

      {/* Getting Started — first-run adoption guide; auto-hides once complete. */}
      {onboarding && !onboarding.allDone && (
        <GettingStarted steps={onboarding.steps} doneCount={onboarding.doneCount} total={onboarding.total} />
      )}

      <HomeKpis kpis={view.kpis} />

      {/* 12-column band: feed 8, side card 4. Without a side card (the role
          may see none of its sources) the feed takes the full width. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section
          aria-labelledby="home-attention-heading"
          className={view.side ? "min-w-0 lg:col-span-8" : "min-w-0 lg:col-span-12"}
        >
          <AttentionFeed items={view.attention} asOf={view.asOf} className="h-full" />
        </section>
        {view.side && (
          <aside aria-label={view.side.title} className="min-w-0 lg:col-span-4">
            <SideCard card={view.side} className="h-full" />
          </aside>
        )}
      </div>

      <section aria-labelledby="home-pulse-heading" className="flex flex-col gap-3">
        <h2 id="home-pulse-heading" className="text-lede font-semibold text-foreground">
          Team pulse
        </h2>
        <ActivityFeed />
      </section>
    </div>
  );
}
