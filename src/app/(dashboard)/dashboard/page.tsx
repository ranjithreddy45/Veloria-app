import type { Metadata } from "next";
import { auth } from "@/../auth";
import { Sparkles } from "lucide-react";
import { getDashboardStats } from "@/actions/dashboard.actions";
import { KpiCards } from "./_components/kpi-cards";
import { RevenueChart } from "./_components/revenue-chart";
import { BookingsChart } from "./_components/bookings-chart";
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

  return (
    <div className="space-y-8">
      {/* Modern Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-6 text-white shadow-lg dark:from-indigo-700 dark:via-indigo-800 dark:to-violet-900 sm:p-8">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-8 top-8 size-24 rounded-full bg-indigo-300/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-indigo-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-indigo-200">
                Dashboard
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting}, {userName}
            </h1>
            <p className="max-w-lg text-sm text-indigo-100/80">
              Here&apos;s an overview of your venue operations. Stay on top of bookings, revenue, and tasks.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCards
        revenue={stats.revenue}
        bookings={stats.bookings}
        leads={stats.leads}
        tasks={stats.tasks}
      />

      {/* Charts Section: Revenue (8/12) + Bookings by Type (4/12) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RevenueChart data={stats.monthlyRevenue} />
        </div>
        <div className="lg:col-span-4">
          <BookingsChart data={stats.bookingsByType} />
        </div>
      </div>

      {/* Bottom Section: Upcoming Events + Overdue Items */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingEvents events={stats.upcomingEvents} />
        <OverdueItems
          tasks={stats.overdueTasks}
          payments={stats.overduePayments}
        />
      </div>
    </div>
  );
}
