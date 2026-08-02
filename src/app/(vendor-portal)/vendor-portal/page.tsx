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
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getVendorDashboard } from "@/actions/vendor-portal.actions";
import { EmptyState } from "@/components/ui/empty-state";
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
      <div className="space-y-6">
        <Card className="rounded-2xl border bg-card py-0 shadow-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<AlertCircle />}
              tone="warning"
              title="We couldn't load your dashboard"
              description={result.error}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = result.data;

  const summaryCards = [
    {
      title: "Upcoming events",
      value: String(data.upcomingEvents),
      description:
        data.upcomingEvents > 0 ? "On your calendar" : "Nothing on the calendar yet",
      icon: CalendarCheck,
      chip: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
      href: "/vendor-portal/events",
    },
    {
      title: "Pending bids",
      value: String(data.pendingBids),
      description:
        data.pendingBids > 0 ? "Awaiting our response" : "Everything has been answered",
      icon: Gavel,
      chip: "bg-warning/15 text-warning",
      href: "/vendor-portal/bids",
    },
    {
      title: "Total payouts",
      value: formatINR(data.totalPayouts),
      description: "Paid to you to date",
      icon: Wallet,
      chip: "bg-success/12 text-success",
      href: "/vendor-portal/payouts",
    },
    {
      title: "Your rating",
      value: data.vendorRating > 0 ? `${data.vendorRating}/5` : "—",
      description:
        data.vendorRating > 0 ? "From the events team" : "Rated after your first event",
      icon: Star,
      chip: "bg-primary/10 text-primary",
      href: "/vendor-portal",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
          <Sparkles className="size-3.5" />
          <span className="text-meta font-semibold uppercase tracking-[0.16em]">
            {VENDOR_CATEGORY_LABELS[data.vendorCategory] || data.vendorCategory}
            {" "}Partner
          </span>
        </div>
        <h1 className="large-title text-h1 leading-tight text-foreground sm:text-h1">
          {data.vendorName}
        </h1>
        <p className="max-w-xl text-copy leading-relaxed text-muted-foreground">
          Welcome back, {session.user.name || "partner"}. Here is where your
          events, bids, and payments with Veloria Grand stand today.
        </p>
      </section>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group block">
              <Card className="h-full rounded-2xl border bg-card py-0 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="text-meta font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {card.title}
                      </p>
                      <p className="numeric text-h2 font-semibold leading-none tracking-[-0.02em] text-foreground">
                        {card.value}
                      </p>
                      <p className="text-detail leading-relaxed text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.chip}`}
                    >
                      <Icon className="size-[18px]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Assignments */}
      <Card className="rounded-2xl border bg-card shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-copy font-semibold">
            Recent assignments
          </CardTitle>
          <Link
            href="/vendor-portal/events"
            className="flex items-center gap-1 text-xs font-medium text-teal-700 transition-colors hover:text-teal-600 dark:text-teal-300"
          >
            View all
            <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentAssignments.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck />}
              title="Nothing booked with you just yet"
              description="When our events team assigns you to a wedding or function, it lands here first."
            />
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
                  className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/12 text-teal-700 dark:text-teal-300">
                    <CalendarCheck className="size-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-copy font-medium text-foreground">
                      {assignment.booking.eventName}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3 flex-shrink-0" />
                      <span className="numeric">{formatDate(assignment.booking.date)}</span>
                      <span className="opacity-40">·</span>
                      <span className="truncate">{assignment.booking.venue.name}</span>
                      {assignment.role && (
                        <>
                          <span className="opacity-40">·</span>
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
      <Card className="rounded-2xl border bg-card shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-copy font-semibold">Pending bids</CardTitle>
          <Link
            href="/vendor-portal/bids"
            className="flex items-center gap-1 text-xs font-medium text-teal-700 transition-colors hover:text-teal-600 dark:text-teal-300"
          >
            View all
            <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.pendingBidsList.length === 0 ? (
            <EmptyState
              icon={<Gavel />}
              title="No bids waiting on us"
              description="Quote an open event from the Bids tab and you'll be able to track it here."
            />
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
                  className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="bg-warning/15 text-warning flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Gavel className="size-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-copy font-medium text-foreground">
                      {bid.booking.eventName}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="numeric">{bid.booking.bookingNumber}</span>
                      <span className="opacity-40">·</span>
                      <span className="numeric">{formatDate(bid.booking.date)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="numeric text-copy font-semibold text-foreground">
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
