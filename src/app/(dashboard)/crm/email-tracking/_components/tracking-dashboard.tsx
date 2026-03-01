"use client";

import * as React from "react";
import {
  MailIcon,
  EyeIcon,
  MousePointerClickIcon,
  PercentIcon,
  TargetIcon,
  CalendarIcon,
  Loader2Icon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTrackingStats, getTrackingEvents, getTopEngagedContacts } from "@/actions/email-tracking.actions";
import type { TrackingStats, TrackingEventRow, TopEngagedContact } from "@/schemas/email-tracking.schema";
import { TrackingEventsTable } from "./tracking-events-table";
import { ContactEngagementCard } from "./contact-engagement-card";

// ============================================================
// Tracking Dashboard Client Component
// ============================================================

interface TrackingDashboardProps {
  initialStats: TrackingStats | null;
  initialEvents: TrackingEventRow[];
  initialTopContacts: TopEngagedContact[];
}

export function TrackingDashboard({
  initialStats,
  initialEvents,
  initialTopContacts,
}: TrackingDashboardProps) {
  const [stats, setStats] = React.useState<TrackingStats | null>(initialStats);
  const [events, setEvents] = React.useState<TrackingEventRow[]>(initialEvents);
  const [topContacts, setTopContacts] =
    React.useState<TopEngagedContact[]>(initialTopContacts);
  const [loading, setLoading] = React.useState(false);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const handleFilter = async () => {
    setLoading(true);
    try {
      const filters = {
        dateRange: {
          from: dateFrom || undefined,
          to: dateTo || undefined,
        },
      };

      const [statsRes, eventsRes, contactsRes] = await Promise.all([
        getTrackingStats(filters),
        getTrackingEvents(filters),
        getTopEngagedContacts(10),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (eventsRes.success) setEvents(eventsRes.data);
      if (contactsRes.success) setTopContacts(contactsRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilter = async () => {
    setDateFrom("");
    setDateTo("");
    setLoading(true);
    try {
      const [statsRes, eventsRes, contactsRes] = await Promise.all([
        getTrackingStats(),
        getTrackingEvents(),
        getTopEngagedContacts(10),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (eventsRes.success) setEvents(eventsRes.data);
      if (contactsRes.success) setTopContacts(contactsRes.data);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "Emails Tracked",
      value: stats?.totalTracked ?? 0,
      icon: MailIcon,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700",
    },
    {
      label: "Total Opens",
      value: stats?.totalOpens ?? 0,
      icon: EyeIcon,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      valueColor: "text-green-700",
    },
    {
      label: "Total Clicks",
      value: stats?.totalClicks ?? 0,
      icon: MousePointerClickIcon,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      valueColor: "text-purple-700",
    },
    {
      label: "Open Rate",
      value: `${(stats?.openRate ?? 0).toFixed(1)}%`,
      icon: PercentIcon,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    {
      label: "Click Rate",
      value: `${(stats?.clickRate ?? 0).toFixed(1)}%`,
      icon: TargetIcon,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      valueColor: "text-rose-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Date Range:
            </span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
              placeholder="From"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
              placeholder="To"
            />
            <Button
              onClick={handleFilter}
              size="sm"
              disabled={loading}
            >
              {loading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Apply
            </Button>
            {(dateFrom || dateTo) && (
              <Button
                onClick={handleClearFilter}
                size="sm"
                variant="outline"
                disabled={loading}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards Row */}
      <div className="grid gap-4 md:grid-cols-5">
        {statCards.map((c) => (
          <Card key={c.label} className="border-zinc-200/80 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-10 items-center justify-center rounded-lg ${c.iconBg}`}
                >
                  <c.icon className={`size-5 ${c.iconColor}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.valueColor}`}>
                    {c.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-Column Layout: Events + Top Contacts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Events — 2/3 width */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              <TrackingEventsTable data={events} />
            </CardContent>
          </Card>
        </div>

        {/* Top Engaged Contacts — 1/3 width */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Engaged Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No engagement data yet.
                </p>
              ) : (
                topContacts.map((contact) => (
                  <ContactEngagementCard
                    key={contact.contactId}
                    contact={contact}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
