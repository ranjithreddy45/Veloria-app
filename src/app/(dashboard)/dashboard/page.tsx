import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { auth } from "@/../auth";
import { CalendarDays, IndianRupee, ListChecks, Trophy, UserPlus, CalendarPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatTile } from "@/components/ui/stat-tile";
import { getDashboardStats } from "@/actions/dashboard.actions";
import { getVelosHeaderSummary } from "@/actions/velos.actions";
import { getOnboardingProgress } from "@/actions/onboarding.actions";
import { GettingStarted } from "./_components/getting-started";
import { WelcomeTour } from "./_components/welcome-tour";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KpiCards } from "./_components/kpi-cards";
import { RevenueChart, BookingsChart } from "./_components/charts-lazy";
import { UpcomingEvents } from "./_components/upcoming-events";
import { OverdueItems } from "./_components/overdue-items";
import { ActivityFeed } from "./_components/activity-feed";

export const metadata: Metadata = { title: "Dashboard" };

// ============================================================
// Greeting helper
// ============================================================

function getGreeting(): string {
  // Use Asia/Kolkata (IST) regardless of server timezone
  const now = new Date();
  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const hour = istTime.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ============================================================
// SectionLabel — the small gradient eyebrow that separates each band of the
// dashboard. One definition so every section reads identically.
// ============================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-3.5 w-[3px] rounded-full bg-gradient-to-b from-violet-500 to-violet-400"
      />
      <h2 className="text-brand-gradient text-[11px] font-semibold uppercase tracking-[0.12em]">
        {children}
      </h2>
    </div>
  );
}

// ============================================================
// Dashboard Page (Server Component)
// ============================================================

export default async function DashboardPage() {
  // Leads created — all-time pipeline volume + this-month intake.
  // Matches the app-wide convention of excluding soft-deleted leads.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [session, stats, velos, onboarding, leadsAllTime, leadsThisMonth] =
    await Promise.all([
      auth(),
      getDashboardStats(),
      getVelosHeaderSummary(),
      getOnboardingProgress(),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.lead.count({
        where: { deletedAt: null, createdAt: { gte: monthStart } },
      }),
    ]);

  const monthLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  const fullName = session?.user?.name || "there";
  const userName = fullName.split(" ")[0];
  const userImage = (session?.user as { image?: string } | undefined)?.image ?? undefined;
  const initials = fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const greeting = getGreeting();

  // A live one-line briefing — the reason to open this every morning.
  const eventsToday = stats.upcomingEvents?.length ?? 0;
  const paymentsDue = stats.overduePayments?.length ?? 0;
  const briefing: { icon: typeof CalendarDays; value: number; label: string }[] = [
    {
      icon: CalendarDays,
      value: eventsToday,
      label: `upcoming ${eventsToday === 1 ? "event" : "events"}`,
    },
    {
      icon: IndianRupee,
      value: paymentsDue,
      label: `${paymentsDue === 1 ? "payment" : "payments"} to collect`,
    },
    {
      icon: ListChecks,
      value: stats.tasks.pending,
      label: `open ${stats.tasks.pending === 1 ? "task" : "tasks"}`,
    },
  ];

  // Format today's date for the contextual eyebrow
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-1">
      {/* First-login orientation — self-gates via localStorage, shows once. */}
      <WelcomeTour />

      {/* ============================================================
          Hero — premium aura command-center header.
          Avatar + greeting + live daily briefing on an ambient violet wash.
          ============================================================ */}
      <div className="bg-aura bg-grid-faint relative -mx-4 -mt-4 overflow-hidden rounded-3xl px-4 pb-7 pt-7 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="relative flex items-start gap-4">
          <Avatar className="hidden size-14 ring-2 ring-violet-500/20 ring-offset-2 ring-offset-background sm:flex">
            <AvatarImage src={userImage} alt={fullName} />
            <AvatarFallback className="bg-violet-500/10 text-base font-semibold text-violet-600 dark:text-violet-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-2.5">
            {/* Contextual eyebrow — today's date with a live pulse */}
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span className="relative inline-flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60 opacity-75" />
                <span className="relative size-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-brand-gradient">{today}</span>
            </div>
            {/* Greeting — large-title display type */}
            <h1 className="large-title text-[30px] leading-[1.05] text-foreground sm:text-[36px]">
              {greeting},{" "}
              <span className="text-brand-gradient">{userName}</span>
            </h1>
            {/* Briefing chips — the at-a-glance "what needs me today" */}
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {briefing.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[12.5px] backdrop-blur-sm"
                >
                  <b.icon className="size-3.5 text-violet-500/80" strokeWidth={2} />
                  <span className="text-foreground/80">
                    <span className="numeric font-semibold text-foreground">
                      {b.value}
                    </span>{" "}
                    {b.label}
                  </span>
                </span>
              ))}
              {velos && velos.players > 0 && (
                <Link
                  href="/performance/velos"
                  className="hover-lift inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500/15 to-violet-400/15 px-2.5 py-1 text-[12.5px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-500/20 transition-colors hover:from-violet-500/20 hover:to-violet-400/20 dark:text-violet-300"
                >
                  <Trophy className="size-3.5" strokeWidth={2} />
                  <span className="numeric">
                    {velos.rank ? `#${velos.rank} of ${velos.players}` : "Join the board"} · {velos.points} pts
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started — first-run adoption guide; auto-hides once complete. */}
      {onboarding && !onboarding.allDone && (
        <GettingStarted steps={onboarding.steps} doneCount={onboarding.doneCount} total={onboarding.total} />
      )}

      {/* ============================================================
          KPI cockpit + pipeline intake
          ============================================================ */}
      <section className="space-y-3">
        <SectionLabel>Today at a glance</SectionLabel>
        <KpiCards
          revenue={stats.revenue}
          bookings={stats.bookings}
          leads={stats.leads}
          tasks={stats.tasks}
          revenueHistory={stats.monthlyRevenue.map((m) => m.revenue)}
        />
        <div className="animate-rise-in animate-stagger-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile
            label="Leads created"
            value={leadsAllTime}
            accent="teal"
            icon={<UserPlus className="size-4" />}
            sub="All-time leads in the pipeline"
          />
          <StatTile
            label="Leads created this month"
            value={leadsThisMonth}
            accent="violet"
            icon={<CalendarPlus className="size-4" />}
            sub={`New leads in ${monthLabel}`}
          />
        </div>
      </section>

      <div className="divider-fade" aria-hidden />

      {/* ============================================================
          Performance — Revenue trend (8/12) + Bookings by type (4/12)
          ============================================================ */}
      <section className="animate-fade-in-up space-y-3" style={{ animationDelay: "120ms" }}>
        <SectionLabel>Performance</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <RevenueChart data={stats.monthlyRevenue} />
          </div>
          <div className="lg:col-span-4">
            <BookingsChart data={stats.bookingsByType} />
          </div>
        </div>
      </section>

      <div className="divider-fade" aria-hidden />

      {/* ============================================================
          What needs me — Upcoming events + Overdue items
          ============================================================ */}
      <section className="animate-fade-in-up space-y-3" style={{ animationDelay: "180ms" }}>
        <SectionLabel>What needs me</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">
          <UpcomingEvents events={stats.upcomingEvents} />
          <OverdueItems
            tasks={stats.overdueTasks}
            payments={stats.overduePayments}
          />
        </div>
      </section>

      <div className="divider-fade" aria-hidden />

      {/* ============================================================
          Live team activity — keeps the dashboard feeling current
          ============================================================ */}
      <section className="animate-fade-in-up space-y-3" style={{ animationDelay: "240ms" }}>
        <SectionLabel>Team pulse</SectionLabel>
        <ActivityFeed />
      </section>
    </div>
  );
}
