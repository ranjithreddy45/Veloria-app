import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronRightIcon,
  Building2Icon,
  TrendingUpIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
} from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getCorporateAccount } from "@/actions/corporate-account.actions";
import { getAccountEvents } from "@/actions/corporate-account-events.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusPill } from "@/components/shared/status-pill";
import { StatTile } from "@/components/ui/stat-tile";
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
      <PageHeader
        icon={Building2Icon}
        accent="gold"
        title={account.accountName}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/accounts" className="transition-colors hover:text-foreground">
              Corporate accounts
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>Account</span>
          </span>
        }
      >
        <StatusBadge status={account.tier} colorMap={CORPORATE_TIER_COLORS} />
        {account.isDue && <StatusPill label="Due to re-engage" hue="amber" />}
      </PageHeader>

      {/* Identity strip — primary contact + ownership at a glance */}
      <div className="grid gap-5 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Primary contact
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
            {account.contact
              ? `${account.contact.firstName} ${account.contact.lastName}${
                  account.contact.designation ? ` · ${account.contact.designation}` : ""
                }`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Reach
          </p>
          <div className="mt-1 space-y-0.5 text-sm">
            {account.contact?.email && (
              <p className="flex items-center gap-1.5 truncate">
                <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                {account.contact.email}
              </p>
            )}
            {account.contact?.phone && (
              <p className="numeric flex items-center gap-1.5">
                <PhoneIcon className="size-3.5 shrink-0 text-muted-foreground" />
                {account.contact.phone}
              </p>
            )}
            {!account.contact?.email && !account.contact?.phone && (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Owner
          </p>
          <p className="mt-1 text-sm">{account.ownerName ?? "Unassigned"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Next re-engage
          </p>
          <p className="numeric mt-1 text-sm">
            {account.nextReengageAt
              ? format(new Date(account.nextReengageAt), "dd MMM yyyy")
              : "—"}
          </p>
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
          accent="gold"
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
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Account notes
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Context the next person picking up this account should know.
          </p>
          {account.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
              {account.notes}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No notes recorded yet.
            </p>
          )}
        </section>
      </div>

      {/* Event history */}
      <AccountEventsTimeline past={events.past} upcoming={events.upcoming} />
    </div>
  );
}
