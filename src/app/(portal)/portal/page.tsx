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
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/../auth";
import { getPortalDashboard } from "@/actions/portal.actions";
import { resolvePortalContactIds } from "@/lib/portal-identity";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_CLIENT_LABELS,
  TIME_SLOT_LABELS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Client Portal" };

// Customer-facing empty states get the editorial serif headline — this is a
// brand surface, not an internal tool.
const PORTAL_EMPTY = "[&_p:first-of-type]:font-editorial [&_p:first-of-type]:text-[18px]";

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

  const [data, identity] = await Promise.all([
    getPortalDashboard(session.user.id),
    resolvePortalContactIds(session.user.id),
  ]);

  const days = data.nextEvent ? daysUntil(new Date(data.nextEvent.date)) : null;

  const summaryCards = [
    {
      title: "Upcoming bookings",
      value: String(data.upcomingBookings),
      description: data.nextEvent
        ? `Next on ${new Date(data.nextEvent.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
        : "Nothing on the calendar yet",
      icon: CalendarCheck,
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/portal/bookings",
    },
    {
      title: "Pending invoices",
      value: String(data.pendingInvoices),
      description:
        data.pendingInvoices > 0 ? "Waiting on you" : "Nothing outstanding",
      icon: FileText,
      color: "text-warning",
      bgColor: "bg-warning/15",
      href: "/portal/invoices",
    },
    {
      title: "Total paid",
      value: formatINR(data.totalPaid),
      description: "Across every booking with us",
      icon: IndianRupee,
      color: "text-success",
      bgColor: "bg-success/12",
      href: "/portal/payments",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome — editorial, calm, unmistakably ours */}
      <section className="border-b pb-9">
        <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
          <Sparkles className="size-3.5" />
          Welcome back
        </div>
        <h1 className="text-foreground mt-3 text-[34px] sm:text-[42px]">
          {session.user.name || "Guest"}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl text-[15px] leading-relaxed">
          Everything for your celebration — bookings, payments and documents —
          gathered in one place.
        </p>

        {/* Event Countdown */}
        {data.nextEvent && days !== null && days >= 0 && (
          <div className="bg-card shadow-card mt-7 inline-flex items-center gap-4 rounded-2xl border px-5 py-4">
            <span className="bg-warning/15 text-warning flex size-11 shrink-0 items-center justify-center rounded-xl">
              <PartyPopper className="size-5" />
            </span>
            <div>
              <p className="text-foreground text-[15px] font-semibold">
                <span className="numeric text-[17px]">{days}</span> day
                {days !== 1 ? "s" : ""} until your event
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
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
      </section>

      {/* C9: unverified account — never silently show empty/foreign data. */}
      {!identity.verified && (
        <div className="border-warning/30 bg-warning/[0.08] flex items-start gap-3.5 rounded-2xl border p-5">
          <ShieldAlert className="text-warning mt-0.5 size-5 flex-shrink-0" />
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Let&apos;s get your portal verified
            </h3>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Give us a call and we&apos;ll activate it right away. Until then
              your bookings, invoices and documents stay hidden.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="block">
              <Card className="group shadow-card hover:shadow-card-hover h-full rounded-2xl py-0 transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
                        {card.title}
                      </p>
                      <p className="numeric text-foreground text-[26px] font-semibold leading-none">
                        {card.value}
                      </p>
                      <p className="text-muted-foreground/80 text-xs">
                        {card.description}
                      </p>
                    </div>
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.bgColor}`}
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
        <Card className="shadow-card overflow-hidden rounded-2xl">
          <div className="border-primary/70 border-l-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Next Event
                </CardTitle>
                <Link
                  href={`/portal/bookings/${data.nextEvent.id}`}
                  className="text-primary flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
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
                    <h3 className="font-editorial text-foreground text-[22px] font-semibold">
                      {data.nextEvent.eventName}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {data.nextEvent.eventType}
                    </p>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="text-muted-foreground/60 size-4" />
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
                      <MapPin className="text-muted-foreground/60 size-4" />
                      <span>{data.nextEvent.venueName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="text-muted-foreground/60 size-4" />
                      <span>
                        <span className="numeric">
                          {data.nextEvent.guestCount}
                        </span>{" "}
                        guests
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <StatusBadge
                    status={data.nextEvent.status}
                    colorMap={BOOKING_STATUS_COLORS}
                    label={BOOKING_STATUS_CLIENT_LABELS[data.nextEvent.status]}
                  />
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Recent Bookings */}
      <Card className="shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
            Your Bookings
          </CardTitle>
          <Link
            href="/portal/bookings"
            className="text-primary flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
          >
            View all
            <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentBookings.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck />}
              title="Your story starts here"
              description="The moment your date is confirmed, it appears here with everything you need for the day."
              className={PORTAL_EMPTY}
            />
          ) : (
            <div className="space-y-2">
              {data.recentBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/portal/bookings/${booking.id}`}
                  className="block"
                >
                  <div className="hover:bg-muted/60 flex items-center gap-4 rounded-xl border p-4 transition-colors">
                    <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <CalendarCheck className="text-primary size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {booking.eventName}
                      </p>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                        <Clock className="size-3 flex-shrink-0" />
                        <span className="numeric">
                          {new Date(booking.date).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-muted-foreground/40">&middot;</span>
                        <span className="truncate">{booking.venueName}</span>
                      </div>
                    </div>
                    <StatusBadge
                      status={booking.status}
                      colorMap={BOOKING_STATUS_COLORS}
                      label={BOOKING_STATUS_CLIENT_LABELS[booking.status]}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-muted-foreground mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Your bookings",
            description: "Every event and date, in one place",
            icon: CalendarCheck,
            href: "/portal/bookings",
            color: "text-primary",
            bgColor: "bg-primary/10",
          },
          {
            title: "Settle an invoice",
            description: "Review and pay in a couple of taps",
            icon: CreditCard,
            href: "/portal/invoices",
            color: "text-success",
            bgColor: "bg-success/12",
          },
          {
            title: "Your documents",
            description: "Contracts, agreements and files",
            icon: FolderOpen,
            href: "/portal/documents",
            color: "text-muted-foreground",
            bgColor: "bg-muted",
          },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href} className="block">
                <Card className="group shadow-card hover:shadow-card-hover h-full rounded-2xl py-0 transition-all duration-200">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div
                      className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${action.bgColor}`}
                    >
                      <Icon className={`size-[22px] ${action.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-semibold">
                        {action.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {action.description}
                      </p>
                    </div>
                    <ArrowUpRight className="text-muted-foreground/40 group-hover:text-primary ml-auto size-4 shrink-0 transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
