import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  FileText,
  IndianRupee,
  Clock,
  ArrowUpRight,
  PartyPopper,
  MapPin,
  Users,
  CreditCard,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalDashboard } from "@/actions/portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  BOOKING_STATUS_COLORS,
  TIME_SLOT_LABELS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Client Portal" };

// ============================================================
// Helper: Days until a given date
// ============================================================

function daysUntil(date: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// Portal Home Page
// ============================================================

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const data = await getPortalDashboard(session.user.id);

  const days = data.nextEvent ? daysUntil(new Date(data.nextEvent.date)) : null;

  const summaryCards = [
    {
      title: "Upcoming Bookings",
      value: String(data.upcomingBookings),
      description: data.nextEvent
        ? `Next: ${new Date(data.nextEvent.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
        : "No upcoming events",
      icon: CalendarCheck,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      href: "/portal/bookings",
    },
    {
      title: "Pending Invoices",
      value: String(data.pendingInvoices),
      description: data.pendingInvoices > 0 ? "Action required" : "All clear",
      icon: FileText,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      href: "/portal/invoices",
    },
    {
      title: "Total Paid",
      value: formatINR(data.totalPaid),
      description: "Across all bookings",
      icon: IndianRupee,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      href: "/portal/payments",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-200">
            <Sparkles className="size-4" />
            <span className="text-sm font-medium">Welcome back</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {session.user.name || "Guest"}
          </h1>
          <p className="mt-1 text-sm text-indigo-200">
            Manage your bookings, invoices, and documents in one place.
          </p>

          {/* Event Countdown */}
          {data.nextEvent && days !== null && days >= 0 && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-xl bg-white/15 px-5 py-3 backdrop-blur-sm">
              <PartyPopper className="size-5 text-yellow-300" />
              <div>
                <p className="text-sm font-semibold">
                  Your next event is in{" "}
                  <span className="text-yellow-300">{days} day{days !== 1 ? "s" : ""}!</span>
                </p>
                <p className="text-xs text-indigo-200">
                  {data.nextEvent.eventName} &middot;{" "}
                  {new Date(data.nextEvent.date).toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="group border-zinc-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-zinc-500">
                        {card.title}
                      </p>
                      <p className="text-2xl font-bold tracking-tight text-zinc-900">
                        {card.value}
                      </p>
                      <p className="text-xs text-zinc-400">{card.description}</p>
                    </div>
                    <div
                      className={`flex size-10 items-center justify-center rounded-lg ${card.bgColor} transition-transform duration-200 group-hover:scale-110`}
                    >
                      <Icon className={`size-5 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Next Event Card */}
      {data.nextEvent && (
        <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
          <div className="border-l-4 border-indigo-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-zinc-900">
                  Next Event
                </CardTitle>
                <Link
                  href={`/portal/bookings/${data.nextEvent.id}`}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                >
                  View details
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">
                      {data.nextEvent.eventName}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {data.nextEvent.eventType}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-4 text-indigo-500" />
                      <span>
                        {new Date(data.nextEvent.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {" "}&middot;{" "}
                        {TIME_SLOT_LABELS[data.nextEvent.timeSlot] || data.nextEvent.timeSlot}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-4 text-indigo-500" />
                      <span>{data.nextEvent.venueName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-4 text-indigo-500" />
                      <span>{data.nextEvent.guestCount} guests</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <StatusBadge
                    status={data.nextEvent.status}
                    colorMap={BOOKING_STATUS_COLORS}
                  />
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Recent Bookings */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-zinc-900">
            Your Bookings
          </CardTitle>
          <Link
            href="/portal/bookings"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            View all
            <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarCheck className="size-10 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-500">
                No bookings yet
              </p>
              <p className="text-xs text-zinc-400">
                Your bookings will appear here once created.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/portal/bookings/${booking.id}`}
                  className="block"
                >
                  <div className="flex items-center gap-4 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 transition-colors hover:bg-zinc-50 hover:border-indigo-100">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50">
                      <CalendarCheck className="size-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {booking.eventName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="size-3 flex-shrink-0" />
                        <span>
                          {new Date(booking.date).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-zinc-300">|</span>
                        <span className="truncate">{booking.venueName}</span>
                      </div>
                    </div>
                    <StatusBadge
                      status={booking.status}
                      colorMap={BOOKING_STATUS_COLORS}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "View Bookings",
            description: "See all your events and dates",
            icon: CalendarCheck,
            href: "/portal/bookings",
            color: "text-indigo-600",
            bgColor: "bg-indigo-50",
          },
          {
            title: "Pay Invoice",
            description: "View and pay pending invoices",
            icon: CreditCard,
            href: "/portal/invoices",
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
          },
          {
            title: "View Documents",
            description: "Access contracts and files",
            icon: FolderOpen,
            href: "/portal/documents",
            color: "text-purple-600",
            bgColor: "bg-purple-50",
          },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.title} href={action.href}>
              <Card className="group border-zinc-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200">
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex size-12 items-center justify-center rounded-xl ${action.bgColor} transition-transform duration-200 group-hover:scale-110`}
                  >
                    <Icon className={`size-6 ${action.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {action.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {action.description}
                    </p>
                  </div>
                  <ArrowUpRight className="ml-auto size-4 text-zinc-300 transition-colors group-hover:text-indigo-500" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
