import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getFranchisePartner,
  getAttachableVenues,
} from "@/actions/franchise.actions";
import {
  getRevenueShareConfigs,
  getRevenueSharePayouts,
} from "@/actions/franchise-revshare.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { Building2, IndianRupee, Users, Wallet } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { computeVenuePnl, currentPeriod } from "@/lib/franchise/pnl";
import { OnboardingWizard } from "./_components/onboarding-wizard";
import { RevshareConfigForm } from "./_components/revshare-config-form";
import { PayoutsPanel } from "./_components/payouts-panel";
import { VenueStorefrontForm } from "./_components/venue-storefront-form";

export const metadata: Metadata = { title: "Franchise Partner" };

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  PENDING_REVIEW:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  ACTIVE:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  SUSPENDED:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
};

interface PageProps {
  params: Promise<{ partnerId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function FranchisePartnerPage({
  params,
  searchParams,
}: PageProps) {
  const { partnerId } = await params;
  const { tab } = await searchParams;

  const result = await getFranchisePartner(partnerId);
  if (!result.success) {
    notFound();
  }
  const partner = result.data;

  const [configsResult, payoutsResult, attachableResult] = await Promise.all([
    getRevenueShareConfigs(partnerId),
    getRevenueSharePayouts({ partnerId }),
    getAttachableVenues(partnerId),
  ]);
  const configs = configsResult.success ? configsResult.data : [];
  const payouts = payoutsResult.success ? payoutsResult.data : [];
  const attachableVenues = attachableResult.success ? attachableResult.data : [];

  // Per-venue P&L for the current period.
  const period = currentPeriod();
  const venues = partner.venues ?? [];
  const pnls = await Promise.all(
    venues.map(async (fv: { venueId: string; venue?: { name?: string } }) => {
      const pnl = await computeVenuePnl(fv.venueId, period).catch(() => null);
      return { venueId: fv.venueId, name: fv.venue?.name ?? fv.venueId, pnl };
    })
  );

  const mtdGross = pnls.reduce((s, p) => s + (p.pnl?.grossRevenue ?? 0), 0);
  const mtdNet = pnls.reduce((s, p) => s + (p.pnl?.netRevenue ?? 0), 0);
  const pendingCount = payouts.filter(
    (p: { status: string }) => p.status === "PENDING"
  ).length;

  const defaultTab =
    tab && ["overview", "onboarding", "venues", "revshare", "payouts", "pnl"].includes(tab)
      ? tab
      : "overview";

  return (
    <div className="space-y-6">
      <PageHeader
        title={partner.name}
        description={partner.legalName ?? "Franchise partner"}
      >
        <StatusBadge status={partner.status} colorMap={STATUS_COLORS} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Venues" value={venues.length} accent="gold" icon={<Building2 />} />
        <StatTile
          label={`MTD gross (${period})`}
          value={formatINR(mtdGross)}
          accent="emerald"
          icon={<IndianRupee />}
        />
        <StatTile
          label={`MTD net (${period})`}
          value={formatINR(mtdNet)}
          accent="blue"
          icon={<Wallet />}
        />
        <StatTile
          label="Pending payouts"
          value={pendingCount}
          accent="amber"
          icon={<Users />}
        />
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="venues">Venues ({venues.length})</TabsTrigger>
          <TabsTrigger value="revshare">Revenue Share ({configs.length})</TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({payouts.length})</TabsTrigger>
          <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Partner details</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Contact email</dt>
                <dd>{partner.contactEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contact phone</dt>
                <dd>{partner.contactPhone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd>{partner.ownerUser?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Onboarding step</dt>
                <dd className="tabular-nums">{partner.onboardingStep}</dd>
              </div>
            </dl>
            {partner.notes && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {partner.notes}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <OnboardingWizard
            partnerId={partner.id}
            status={partner.status}
            initialStep={partner.onboardingStep}
            initialData={
              (partner.onboardingData as Record<string, unknown>) ?? {}
            }
            attachableVenues={attachableVenues}
            attachedVenues={venues.map(
              (fv: { id: string; venueId: string; venue?: { name?: string } }) => ({
                id: fv.id,
                venueId: fv.venueId,
                name: fv.venue?.name ?? fv.venueId,
              })
            )}
          />
        </TabsContent>

        <TabsContent value="venues" className="mt-4 space-y-4">
          {venues.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No venues attached yet. Use the Onboarding tab to attach venues.
            </p>
          )}
          {venues.map(
            (fv: {
              id: string;
              venueId: string;
              venue?: { name?: string };
              storefrontSlug: string | null;
              brandName: string | null;
              logoUrl: string | null;
              primaryColor: string | null;
              customDomain: string | null;
              isStorefrontLive: boolean;
            }) => (
              <VenueStorefrontForm
                key={fv.id}
                franchiseVenueId={fv.id}
                venueName={fv.venue?.name ?? fv.venueId}
                initial={{
                  storefrontSlug: fv.storefrontSlug,
                  brandName: fv.brandName,
                  logoUrl: fv.logoUrl,
                  primaryColor: fv.primaryColor,
                  customDomain: fv.customDomain,
                  isStorefrontLive: fv.isStorefrontLive,
                }}
              />
            )
          )}
        </TabsContent>

        <TabsContent value="revshare" className="mt-4">
          <RevshareConfigForm
            partnerId={partner.id}
            venues={venues.map(
              (fv: { venueId: string; venue?: { name?: string } }) => ({
                id: fv.venueId,
                name: fv.venue?.name ?? fv.venueId,
              })
            )}
            configs={configs}
          />
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <PayoutsPanel
            partnerId={partner.id}
            venues={venues.map(
              (fv: { venueId: string; venue?: { name?: string } }) => ({
                id: fv.venueId,
                name: fv.venue?.name ?? fv.venueId,
              })
            )}
            payouts={payouts}
          />
        </TabsContent>

        <TabsContent value="pnl" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Venue</th>
                  <th className="px-4 py-2.5 text-right font-medium">Gross</th>
                  <th className="px-4 py-2.5 text-right font-medium">Expenses</th>
                  <th className="px-4 py-2.5 text-right font-medium">Net</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bookings</th>
                </tr>
              </thead>
              <tbody>
                {pnls.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                      No venues attached.
                    </td>
                  </tr>
                )}
                {pnls.map((p) => (
                  <tr key={p.venueId} className="border-t border-border">
                    <td className="px-4 py-2.5">{p.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(p.pnl?.grossRevenue ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatINR(p.pnl?.expenses ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatINR(p.pnl?.netRevenue ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.pnl?.bookingCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Cash-basis: gross = COMPLETED payments paid in {period}; expenses =
            PAID vendor/owner payouts in {period}. Reconciles with Reports.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
