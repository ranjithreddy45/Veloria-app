import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  Gavel,
  Wallet,
  Star,
  Clock,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getVendorDashboard } from "@/actions/vendor-portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  BOOKING_STATUS_COLORS,
  VENDOR_BID_STATUS_COLORS,
  VENDOR_CATEGORY_LABELS,
} from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendor Portal" };

// ============================================================
// Vendor Portal Dashboard
// ============================================================

export default async function VendorPortalPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const result = await getVendorDashboard();

  if (!result.success) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Unable to load dashboard
          </h2>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {result.error}
          </p>
        </div>
      </div>
    );
  }

  const data = result.data;

  const summaryCards = [
    {
      title: "Upcoming Events",
      value: String(data.upcomingEvents),
      description: data.upcomingEvents > 0 ? "Assigned to you" : "No upcoming events",
      icon: CalendarCheck,
      color: "text-violet-600",
      bgColor: "bg-violet-50",
      href: "/vendor-portal/events",
    },
    {
      title: "Pending Bids",
      value: String(data.pendingBids),
      description: data.pendingBids > 0 ? "Awaiting response" : "All bids responded",
      icon: Gavel,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      href: "/vendor-portal/bids",
    },
    {
      title: "Total Payouts",
      value: formatINR(data.totalPayouts),
      description: "Total paid to date",
      icon: Wallet,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      href: "/vendor-portal/payouts",
    },
    {
      title: "Rating",
      value: data.vendorRating > 0 ? `${data.vendorRating}/5` : "N/A",
      description: data.vendorRating > 0 ? "Your current rating" : "Not yet rated",
      icon: Star,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      href: "/vendor-portal",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-purple-700 px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-violet-200">
            <Sparkles className="size-4" />
            <span className="text-sm font-medium">Vendor Dashboard</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {data.vendorName}
          </h1>
          <p className="mt-1 text-sm text-violet-200">
            {VENDOR_CATEGORY_LABELS[data.vendorCategory] || data.vendorCategory}
            {" "}&middot;{" "}
            Welcome back, {session.user.name || "Vendor"}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="group border-zinc-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:border-violet-200 dark:border-zinc-800 dark:hover:border-violet-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {card.title}
                      </p>
                      <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {card.value}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {card.description}
                      </p>
                    </div>
                    <div
                      className={`flex size-10 items-center justify-center rounded-lg ${card.bgColor} transition-transform duration-200 group-hover:scale-110 dark:opacity-90`}
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

      {/* Recent Assignments */}
      <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Assignments
          </CardTitle>
          <Link
            href="/vendor-portal/events"
            className="flex items-center gap-1 text-xs font-medium text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400"
          >
            View all
            <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarCheck className="size-10 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                No assignments yet
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                You will see your assigned bookings here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentAssignments.map((assignment: {
                id: string;
                role: string | null;
                status: string;
                booking: {
                  id: string;
                  bookingNumber: string;
                  eventName: string;
                  eventType: string;
                  date: string;
                  status: string;
                  venue: { id: string; name: string };
                };
              }) => (
                <div
                  key={assignment.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
                    <CalendarCheck className="size-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate dark:text-zinc-100">
                      {assignment.booking.eventName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <Clock className="size-3 flex-shrink-0" />
                      <span>{formatDate(assignment.booking.date)}</span>
                      <span className="text-zinc-300 dark:text-zinc-600">|</span>
                      <span className="truncate">{assignment.booking.venue.name}</span>
                      {assignment.role && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-600">|</span>
                          <span className="truncate">{assignment.role}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusBadge
                    status={assignment.booking.status}
                    colorMap={BOOKING_STATUS_COLORS}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Bids */}
      <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Pending Bids
          </CardTitle>
          <Link
            href="/vendor-portal/bids"
            className="flex items-center gap-1 text-xs font-medium text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400"
          >
            View all
            <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.pendingBidsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Gavel className="size-10 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                No pending bids
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Your submitted bids will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.pendingBidsList.map((bid: {
                id: string;
                amount: number;
                message: string | null;
                status: string;
                submittedAt: string;
                booking: {
                  id: string;
                  bookingNumber: string;
                  eventName: string;
                  date: string;
                };
              }) => (
                <div
                  key={bid.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                    <Gavel className="size-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate dark:text-zinc-100">
                      {bid.booking.eventName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{bid.booking.bookingNumber}</span>
                      <span className="text-zinc-300 dark:text-zinc-600">|</span>
                      <span>{formatDate(bid.booking.date)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatINR(bid.amount)}
                    </span>
                    <StatusBadge
                      status={bid.status}
                      colorMap={VENDOR_BID_STATUS_COLORS}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
