import type { Metadata } from "next";
import { auth } from "@/../auth";
import { CalendarDays, IndianRupee, ListChecks } from "lucide-react";
import { getDashboardStats } from "@/actions/dashboard.actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  const fullName = session?.user?.name || "there";
  const userName = fullName.split(" ")[0];
  const userImage = (session?.user as { image?: string } | undefined)?.image ?? undefined;
  const initials = fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const greeting = getGreeting();

  // A live one-line briefing — the reason to open this every morning.
  const eventsToday = stats.upcomingEvents?.length ?? 0;
  const paymentsDue = stats.overduePayments?.length ?? 0;
  const briefing: { icon: typeof CalendarDays; text: string }[] = [
    { icon: CalendarDays, text: `${eventsToday} upcoming ${eventsToday === 1 ? "event" : "events"}` },
    { icon: IndianRupee, text: `${paymentsDue} ${paymentsDue === 1 ? "payment" : "payments"} to collect` },
    { icon: ListChecks, text: `${stats.tasks.pending} open ${stats.tasks.pending === 1 ? "task" : "tasks"}` },
  ];

  // Format today's date for the contextual eyebrow
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-1">
      {/* Hero — avatar + greeting + live daily briefing */}
      <div className="animate-fade-in-up flex items-start gap-4">
        <Avatar className="hidden size-12 ring-2 ring-primary/10 sm:flex">
          <AvatarImage src={userImage} alt={fullName} />
          <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span className="relative inline-flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60 opacity-75" />
              <span className="relative size-1.5 rounded-full bg-emerald-500" />
            </span>
            {today}
          </div>
          <h1 className="text-[27px] font-medium leading-[1.1] tracking-[-0.01em] text-foreground">
            {greeting}, {userName}
          </h1>
          {/* Briefing chips — the at-a-glance "what needs me today" */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground">
            {briefing.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <b.icon className="size-3.5 text-primary/70" strokeWidth={2} />
                <span className="tabular-nums text-foreground/80">{b.text}</span>
              </span>
            ))}
          </div>
        </div>
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
      <div className="animate-fade-in-up grid gap-4 lg:grid-cols-12" style={{ animationDelay: "120ms" }}>
        <div className="lg:col-span-8">
          <RevenueChart data={stats.monthlyRevenue} />
        </div>
        <div className="lg:col-span-4">
          <BookingsChart data={stats.bookingsByType} />
        </div>
      </div>

      {/* Bottom: Upcoming Events + Overdue Items */}
      <div className="animate-fade-in-up grid gap-4 lg:grid-cols-2" style={{ animationDelay: "180ms" }}>
        <UpcomingEvents events={stats.upcomingEvents} />
        <OverdueItems
          tasks={stats.overdueTasks}
          payments={stats.overduePayments}
        />
      </div>
    </div>
  );
}
