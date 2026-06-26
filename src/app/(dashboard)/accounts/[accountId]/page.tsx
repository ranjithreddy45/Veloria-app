import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  Building2Icon,
  TrendingUpIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  ClockIcon,
} from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getCorporateAccount } from "@/actions/corporate-account.actions";
import { getAccountEvents } from "@/actions/corporate-account-events.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommitmentOfferForm } from "../_components/commitment-offer-form";
import {
  AccountEventsTimeline,
  type AccountEvent,
} from "../_components/account-events-timeline";
import { CORPORATE_TIER_COLORS } from "../_components/tier-colors";

export const metadata: Metadata = {
  title: "Corporate Account",
};

interface AccountDetail {
  id: string;
  accountName: string;
  tier: string;
  lastEventDate: string | null;
  nextReengageAt: string | null;
  reengageCadenceId: string | null;
  committedEventsPerYear: number;
  lockedPricePerPlate: number | null;
  commitmentStart: string | null;
  commitmentEnd: string | null;
  pastEventCount: number;
  upcomingEventCount: number;
  lifetimeRevenue: number;
  ownerUserId: string | null;
  ownerName: string | null;
  notes: string | null;
  isDue: boolean;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    designation: string | null;
  } | null;
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  const session = await auth();
  const canManage = hasPermission(session?.user?.role ?? "", "accounts:manage");

  const [accountResult, eventsResult] = await Promise.all([
    getCorporateAccount(accountId),
    getAccountEvents(accountId),
  ]);

  if (!accountResult.success) notFound();
  const account = accountResult.data as AccountDetail;

  const events = eventsResult.success
    ? (eventsResult.data as { past: AccountEvent[]; upcoming: AccountEvent[] })
    : { past: [], upcoming: [] };

  return (
    <div className="space-y-6">
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to accounts
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Building2Icon className="size-7 text-violet-600" />
            <h1 className="text-2xl font-semibold tracking-tight">{account.accountName}</h1>
            <StatusBadge status={account.tier} colorMap={CORPORATE_TIER_COLORS} />
            {account.isDue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <ClockIcon className="size-3" /> Due to re-engage
              </span>
            )}
          </div>
          {account.contact && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <UserIcon className="size-3.5" />
                {account.contact.firstName} {account.contact.lastName}
                {account.contact.designation ? ` · ${account.contact.designation}` : ""}
              </span>
              {account.contact.email && (
                <span className="inline-flex items-center gap-1">
                  <MailIcon className="size-3.5" />
                  {account.contact.email}
                </span>
              )}
              {account.contact.phone && (
                <span className="inline-flex items-center gap-1">
                  <PhoneIcon className="size-3.5" />
                  {account.contact.phone}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>Owner: {account.ownerName ?? "Unassigned"}</div>
          <div>
            Next re-engage:{" "}
            {account.nextReengageAt
              ? format(new Date(account.nextReengageAt), "dd MMM yyyy")
              : "—"}
          </div>
        </div>
      </div>

      {/* Rollups */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Lifetime revenue"
          value={`₹${account.lifetimeRevenue.toLocaleString("en-IN")}`}
          accent="blue"
          icon={<TrendingUpIcon />}
        />
        <StatTile
          label="Past events"
          value={account.pastEventCount}
          accent="emerald"
          icon={<CalendarCheckIcon />}
          sub={
            account.lastEventDate
              ? `Last: ${format(new Date(account.lastEventDate), "dd MMM yyyy")}`
              : "No events yet"
          }
        />
        <StatTile
          label="Upcoming events"
          value={account.upcomingEventCount}
          accent="violet"
          icon={<CalendarClockIcon />}
        />
        <StatTile
          label="Committed / year"
          value={account.committedEventsPerYear || "—"}
          accent="amber"
          icon={<Building2Icon />}
          sub={
            account.lockedPricePerPlate != null
              ? `Locked ₹${account.lockedPricePerPlate.toLocaleString("en-IN")}/plate`
              : "No locked rate"
          }
        />
      </div>

      {/* Commitment offer + notes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CommitmentOfferForm
          accountId={account.id}
          committedEventsPerYear={account.committedEventsPerYear}
          lockedPricePerPlate={account.lockedPricePerPlate}
          commitmentStart={account.commitmentStart}
          commitmentEnd={account.commitmentEnd}
          canManage={canManage}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account notes</CardTitle>
          </CardHeader>
          <CardContent>
            {account.notes ? (
              <p className="whitespace-pre-wrap text-sm">{account.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event history */}
      <AccountEventsTimeline past={events.past} upcoming={events.upcoming} />
    </div>
  );
}
