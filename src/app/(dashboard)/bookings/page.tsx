import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  CalendarCheckIcon,
  ClockIcon,
  CalendarRangeIcon,
  IndianRupeeIcon,
} from "lucide-react";

import { auth } from "@/../auth";
import { getBookings, getBookingStats } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions, type QuickActionSpec } from "@/components/ui/quick-actions";
import { HelpHint } from "@/components/layout/help-hint";
import { visibleActions } from "@/lib/permission-claims";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingsViews } from "./_components/bookings-views";

export const metadata: Metadata = { title: "Bookings" };

// ============================================================
// Bookings List Page
// ============================================================

const BOOKING_STATUSES = new Set([
  "HOLD",
  "TENTATIVE",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
]);

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  // `?status=` — validated against the enum before it reaches Prisma, so an
  // unknown value is ignored rather than throwing a generic "failed to fetch".
  //
  // The calendar links here with status=CANCELLED when it finds cancelled
  // bookings it had to hide (especially paid ones). Without this the link
  // silently landed on the unfiltered list, which is its own small lie.
  const sp = await searchParams;
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = raw && BOOKING_STATUSES.has(raw) ? (raw as never) : undefined;

  // Ceiling lets the client table page through rows without the default-50
  // cutoff, while keeping the payload far lighter than 1000.
  const [result, statsResult, session] = await Promise.all([
    getBookings({ limit: 500, status }),
    getBookingStats(),
    auth(),
  ]);

  const bookings = result.success ? result.data.data : [];

  // ---- Headline metrics: DB-wide aggregates, not the 500-row slice ----
  // Summing the loaded rows would understate every KPI once the table grows
  // past the page ceiling, so the tiles read from getBookingStats instead.
  const stats = statsResult.success
    ? statsResult.data
    : {
        total: bookings.length,
        confirmedCount: 0,
        pendingCount: 0,
        thisMonthCount: 0,
        confirmedRevenue: 0,
        holdsValue: 0,
      };

  const totalCount = stats.total;
  const confirmedCount = stats.confirmedCount;
  const pendingCount = stats.pendingCount;
  const thisMonthCount = stats.thisMonthCount;
  const confirmedRevenue = stats.confirmedRevenue;
  const holdsValue = stats.holdsValue;

  const fmtCurrency = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)} K`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  const hasData = totalCount > 0;

  // The page's one action: its create, gated on the permission createBooking
  // enforces. Calendar, quotations and invoices are reached from the sidebar.
  // The hint stays plain: /bookings/new makes a booking without the advance
  // check that blocking a slot from a quotation applies.
  // createBooking checks the static role matrix (bookings:create, or
  // bookings:block-reduced-advance), so that exact check is required too
  // (`when`): a permission granted only through an override would otherwise
  // show a pill whose form fails on save.
  const role = session?.user?.role ?? "";
  const actions = visibleActions<QuickActionSpec>(session, [
    {
      href: "/bookings/new",
      label: "New booking",
      hint: "Add a booking",
      permission: "bookings:create",
      when:
        hasPermission(role, "bookings:create") ||
        hasPermission(role, "bookings:block-reduced-advance"),
      primary: true,
    },
  ]);
  // The empty state offers "New booking" under exactly the same decision as
  // the pill, so a role that cannot create bookings is never shown a create
  // button the pill would hide from it.
  const canCreateBookings = actions.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Operations · Calendar</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{totalCount}</span> total
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{confirmedCount}</span> confirmed
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{thisMonthCount}</span> this month
            </span>
          </div>
        }
        description="Manage event bookings, venues, and scheduling."
        help={
          <HelpHint title="What is a Booking?">
            <p>
              A <strong>Booking</strong> is a <em>confirmed event</em> — a venue,
              date, and time slot reserved for a client, with the guest count and
              full commercials (per-plate, hall rental, decor, other services).
            </p>
            <p>
              Bookings usually come from a won <strong>Deal</strong>, and they
              power everything downstream: invoices, tasks, vendors, and
              operations. Each booking holds a slot so the venue can&rsquo;t be
              double-booked.
            </p>
            <p className="text-foreground/70">
              Flow: Contact → Lead → Deal → <strong>Booking</strong>.
            </p>
          </HelpHint>
        }
        actions={<QuickActions actions={actions} />}
      />

      {hasData && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-rise-in animate-stagger-1">
          <StatTile
            label="Confirmed"
            value={confirmedCount}
            accent="emerald"
            icon={<CalendarCheckIcon className="size-4" />}
            sub={`of ${totalCount} bookings`}
          />
          <StatTile
            label="This month"
            value={thisMonthCount}
            accent="indigo"
            icon={<CalendarRangeIcon className="size-4" />}
            sub="events scheduled"
          />
          <StatTile
            label="Confirmed revenue"
            value={fmtCurrency(confirmedRevenue)}
            accent="gold"
            icon={<IndianRupeeIcon className="size-4" />}
            sub="Contracted — confirmed bookings"
          />
          <StatTile
            label="Pipeline / holds"
            value={fmtCurrency(holdsValue)}
            accent="amber"
            icon={<ClockIcon className="size-4" />}
            sub={`${pendingCount} on hold or tentative`}
          />
        </div>
      )}

      <div className="animate-rise-in animate-stagger-2">
        {bookings.length === 0 ? (
          <div className="rounded-[22px] border border-dashed bg-card/40">
            <EmptyState
              icon={<CalendarCheckIcon className="size-6" />}
              title="No bookings yet"
              description={
                canCreateBookings
                  ? "A booking is a confirmed event — a venue, date, and slot reserved for a client. Create your first booking, or convert a won deal, to start filling the calendar."
                  : "A booking is a confirmed event — a venue, date, and slot reserved for a client. Bookings appear here once they are made."
              }
              action={
                canCreateBookings ? (
                  <Button asChild>
                    <Link href="/bookings/new">
                      <PlusIcon className="mr-2 size-4" />
                      New booking
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <BookingsViews data={bookings} />
        )}
      </div>
    </div>
  );
}
