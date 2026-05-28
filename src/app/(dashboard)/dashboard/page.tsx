import type { Metadata } from "next";
import { auth } from "@/../auth";
import { getDashboardStats } from "@/actions/dashboard.actions";
import { KpiCards } from "./_components/kpi-cards";
import { RevenueChart, BookingsChart } from "./_components/charts-lazy";
import { UpcomingEvents } from "./_components/upcoming-events";
import { OverdueItems } from "./_components/overdue-items";

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
// Dashboard Page (Server Component)
// ============================================================

export default async function DashboardPage() {
  const [session, stats] = await Promise.all([
    auth(),
    getDashboardStats(),
  ]);

  const userName = session?.user?.name?.split(" ")[0] || "there";
  const greeting = getGreeting();

  // Format today's date for the contextual eyebrow
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-1">
      {/* Page heading — eyebrow + greeting */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <span className="relative inline-flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60 opacity-75" />
            <span className="relative size-1.5 rounded-full bg-emerald-500" />
          </span>
          {today}
        </div>
        <h1 className="text-[26px] font-semibold leading-none tracking-[-0.025em] text-foreground">
          {greeting}, {userName}
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Here&apos;s what&apos;s happening across your venue today.
        </p>
      </div>

      {/* KPI Cards */}
      <KpiCards
        revenue={stats.revenue}
        bookings={stats.bookings}
        leads={stats.leads}
        tasks={stats.tasks}
        revenueHistory={stats.monthlyRevenue.map((m) => m.revenue)}
      />

      {/* Charts: Revenue (8/12) + Bookings by Type (4/12) */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RevenueChart data={stats.monthlyRevenue} />
        </div>
        <div className="lg:col-span-4">
          <BookingsChart data={stats.bookingsByType} />
        </div>
      </div>

      {/* Bottom: Upcoming Events + Overdue Items */}
      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingEvents events={stats.upcomingEvents} />
        <OverdueItems
          tasks={stats.overdueTasks}
          payments={stats.overduePayments}
        />
      </div>
    </div>
  );
}
