import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";

import {
  getRevenueAnalytics,
  getBookingAnalytics,
  getLeadConversionFunnel,
  getVenueUtilization,
  getMonthOverMonth,
  getTopClients,
  getCashflow,
} from "@/actions/analytics.actions";

import { AnalyticsDashboard } from "./_components/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Advanced analytics and business intelligence dashboard",
};

// ============================================================
// Analytics Page (Server Component)
// ============================================================

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!hasPermission(session.user.role as string, "analytics:read")) {
    redirect("/not-authorized");
  }

  // Fetch all initial data in parallel
  const [
    revenueRes,
    bookingsRes,
    funnelRes,
    utilizationRes,
    momRes,
    topClientsRes,
    cashflowRes,
  ] = await Promise.all([
    getRevenueAnalytics(),
    getBookingAnalytics(),
    getLeadConversionFunnel(),
    getVenueUtilization(),
    getMonthOverMonth(),
    getTopClients(10),
    getCashflow(),
  ]);

  // Extract data or fall back to empty defaults
  const revenue = revenueRes.success
    ? revenueRes.data
    : {
        totalRevenue: 0,
        monthlyRevenue: [],
        revenueByVenue: [],
        revenueByEventType: [],
        averageBookingValue: 0,
      };

  const bookingsData = bookingsRes.success
    ? bookingsRes.data
    : {
        totalBookings: 0,
        bookingsByStatus: {},
        bookingsByMonth: [],
        bookingsByVenue: [],
        averageGuestCount: 0,
      };

  const funnel = funnelRes.success ? funnelRes.data : [];
  const utilization = utilizationRes.success ? utilizationRes.data : [];
  const mom = momRes.success ? momRes.data : [];
  const topClients = topClientsRes.success ? topClientsRes.data : [];
  const cashflow = cashflowRes.success ? cashflowRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={`Business Intelligence · ${bookingsData.totalBookings} bookings`}
        title="Analytics"
        help={<PageHelp id="analytics" />}
        description="Advanced analytics and business intelligence for your event management operations."
      />

      <AnalyticsDashboard
        initialRevenue={revenue}
        initialBookings={bookingsData}
        initialFunnel={funnel}
        initialUtilization={utilization}
        initialMoM={mom}
        initialTopClients={topClients}
        initialCashflow={cashflow}
      />
    </div>
  );
}
